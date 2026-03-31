(function(root, factory){
  if(typeof module === 'object' && module.exports){
    module.exports = factory();
    return;
  }
  root.MP_BILLING_UI = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  function normalizeSubscriptionStatus(status){
    var normalized = String(status || '').trim().toLowerCase();
    if(!normalized) return 'inactive';
    return normalized.replace(/[^a-z]+/g, '_');
  }

  function formatBillingDate(value){
    if(!value) return 'Not available';
    var date = new Date(value);
    if(isNaN(date.getTime())) return 'Not available';
    return date.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });
  }

  function getTrialDaysRemaining(value, now){
    if(!value) return null;
    var trialEnd = new Date(value);
    var current = now ? new Date(now) : new Date();
    if(isNaN(trialEnd.getTime()) || isNaN(current.getTime())) return null;
    if(
      trialEnd.getUTCFullYear() === current.getUTCFullYear() &&
      trialEnd.getUTCMonth() === current.getUTCMonth() &&
      trialEnd.getUTCDate() === current.getUTCDate()
    ){
      return 0;
    }
    var diff = trialEnd.getTime() - current.getTime();
    if(diff <= 0) return 0;
    return Math.ceil(diff / 86400000);
  }

  function getSubscriptionPresentation(subscription, options){
    var opts = options || {};
    var status = normalizeSubscriptionStatus(subscription && subscription.status);
    var renewalDate = subscription && (subscription.current_period_end || subscription.cancel_at || subscription.ended_at);
    var daysRemaining = status === 'trialing' ? getTrialDaysRemaining(renewalDate, opts.now) : null;
    var accessLevel = opts.accessLevel || 'none';
    var hasPro = !!opts.hasPro;
    var isBeta = !!(subscription && subscription.user_id === 'beta');

    if(status === 'trialing'){
      return {
        status: status,
        statusLabel: 'Trial',
        planCopy: 'Your 7-day free trial is active. Explore the dashboard before choosing a paid plan.',
        renewalDateText: formatBillingDate(renewalDate),
        renewalCopy: daysRemaining === 0
          ? 'Trial access ends today. Upgrade now to avoid losing dashboard access.'
          : 'Trial access ends in ' + daysRemaining + ' day' + (daysRemaining === 1 ? '' : 's') + '. Upgrade before then to keep your dashboard access unlocked.',
        accessLabel: 'Trial Access',
        accessCopy: 'Your trial currently unlocks the core paid dashboard experience until it expires.',
        planName: opts.planName || 'Trial'
      };
    }

    return {
      status: status,
      statusLabel: status === 'past_due' ? 'Past Due' : status === 'canceled' ? 'Canceled' : status === 'active' ? 'Active' : 'Inactive',
      planCopy: status === 'active'
        ? 'Your subscription is active and connected to Stripe checkout plus the billing portal.'
        : isBeta
          ? 'Beta access is active. Premium tabs stay unlocked while beta access is enabled.'
          : 'No active subscription found. Choose a plan to unlock paid billing and premium dashboard tools.',
      renewalDateText: formatBillingDate(renewalDate),
      renewalCopy: renewalDate
        ? (status === 'canceled' ? 'This subscription is set to end on the date above.' : 'Stripe will use this date for the next renewal boundary.')
        : 'Choose a plan and this card will show the next renewal date.',
      accessLabel: hasPro || accessLevel === 'beta' ? 'Unlocked' : 'Upgrade Needed',
      accessCopy: hasPro || accessLevel === 'beta'
        ? 'Trading Cards, Leaderboard, and Trading Calendar are available on this account.'
        : 'Upgrade to Pro to access Trading Cards, Leaderboard, and Trading Calendar.',
      planName: opts.planName || 'No Active Plan'
    };
  }

  function getPricingPagePresentation(subscription, options){
    var opts = options || {};
    var status = normalizeSubscriptionStatus(subscription && subscription.status);
    var planName = opts.planName || 'No Active Plan';
    var renewalDate = subscription && (subscription.current_period_end || subscription.cancel_at || subscription.ended_at);
    var formattedDate = formatBillingDate(renewalDate);
    var daysRemaining = status === 'trialing' ? getTrialDaysRemaining(renewalDate, opts.now) : null;
    var planStates = {
      standard: {
        buttonText: 'GET STANDARD',
        disabled: false,
        metaText: 'Use this if you want the core dashboard without the premium tools.'
      },
      pro: {
        buttonText: 'GET PRO',
        disabled: false,
        metaText: 'Best fit if you want premium research surfaces and full billing controls.'
      }
    };

    if(status === 'trialing'){
      planStates.standard.buttonText = 'ON TRIAL';
      planStates.standard.disabled = true;
      planStates.standard.metaText = 'Your trial currently includes Standard access until ' + formattedDate + '.';
      planStates.pro.buttonText = 'UPGRADE TO PRO';
      planStates.pro.metaText = 'Upgrade at any time to keep premium tools unlocked beyond your trial window.';
      return {
        bannerType: 'info',
        bannerText: 'Your 7-day free trial is active. ' + (daysRemaining === 0 ? 'It ends today before paid access locks.' : daysRemaining + ' day' + (daysRemaining === 1 ? '' : 's') + ' remaining before paid access locks.'),
        planName: planName,
        planStates: planStates
      };
    }

    if(status === 'active'){
      planStates.standard.buttonText = 'CURRENT PLAN';
      planStates.standard.disabled = true;
      planStates.standard.metaText = 'Your current billing is active through ' + formattedDate + '.';
      planStates.pro.buttonText = 'CHANGE TO PRO';
      return {
        bannerType: 'info',
        bannerText: planName + ' is active on your account.',
        planName: planName,
        planStates: planStates
      };
    }

    return {
      bannerType: '',
      bannerText: '',
      planName: planName,
      planStates: planStates
    };
  }

  function canAccessFeature(subscription, requiredPlan){
    if(requiredPlan === 'free' || !requiredPlan) return true;
    var status = normalizeSubscriptionStatus(subscription && subscription.status);
    if(status !== 'active' && status !== 'trialing') return false;
    var planId = String(subscription && subscription.plan_id || '').trim().toLowerCase();
    var current = planId.indexOf('pro') !== -1 ? 'pro' : planId.indexOf('standard') !== -1 || planId.indexOf('basic') !== -1 ? 'standard' : 'none';
    var rank = { none: 0, standard: 1, pro: 2 };
    return (rank[current] || 0) >= (rank[requiredPlan] || 0);
  }

  function getFeatureLockPresentation(requiredPlan, options){
    var opts = options || {};
    if(requiredPlan === 'pro'){
      return {
        eyebrow: 'Pro Feature',
        title: 'Upgrade to access ' + (opts.title || 'this feature'),
        body: opts.detail || 'Upgrade your plan to unlock this premium workflow.',
        cta: 'Upgrade to Pro'
      };
    }
    return {
      eyebrow: 'Standard Feature',
      title: 'Unlock ' + (opts.title || 'this feature'),
      body: opts.detail || 'Start a Standard subscription to continue.',
      cta: 'Start Standard'
    };
  }

  return {
    formatBillingDate: formatBillingDate,
    normalizeSubscriptionStatus: normalizeSubscriptionStatus,
    getTrialDaysRemaining: getTrialDaysRemaining,
    getSubscriptionPresentation: getSubscriptionPresentation,
    getPricingPagePresentation: getPricingPagePresentation,
    canAccessFeature: canAccessFeature,
    getFeatureLockPresentation: getFeatureLockPresentation
  };
});
