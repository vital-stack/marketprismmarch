window.MP_BILLING = (function(){
  var plans = [
    {
      id: 'standard',
      aliases: ['basic'],
      name: 'MarketPrism Standard',
      priceId: 'price_1TEtM5PYE7k13i1B6mxsADp7',
      priceLabel: '$15/mo',
      description: 'Core dashboard access for daily monitoring and signal review.',
      requiredRank: 1
    },
    {
      id: 'pro',
      aliases: [],
      name: 'MarketPrism PRO',
      priceId: 'price_1TEtLbPYE7k13i1ByCkSo2UR',
      priceLabel: '$25/mo',
      description: 'Everything in Standard plus premium tools and upgradeable portal billing.',
      requiredRank: 2
    }
  ];

  var planRank = {
    none: 0,
    standard: 1,
    pro: 2,
    beta: 3
  };

  // Temporary global dashboard unlock for testing.
  // Set to false to restore paid access restrictions.
  var dashboardAccessOverride = true;

  // Temporary testing mode: leave all dashboard tabs unlocked.
  // Restore the gated tabs below when paid access enforcement is needed again.
  var lockedTabs = {
    cards: 'pro',
    calendar: 'pro',
    leaderboard: 'pro'
  };

  function normalize(value){
    return String(value || '').trim().toLowerCase();
  }

  function getPlanByPriceId(priceId){
    var target = normalize(priceId);
    return plans.find(function(plan){
      return normalize(plan.priceId) === target;
    }) || null;
  }

  function inferPlan(planId, priceId){
    var direct = getPlanByPriceId(priceId);
    if(direct) return direct;
    var normalizedPlanId = normalize(planId);
    return plans.find(function(plan){
      if(normalizedPlanId === plan.id || normalizedPlanId.indexOf(plan.id) !== -1){
        return true;
      }
      return (plan.aliases || []).some(function(alias){
        var normalizedAlias = normalize(alias);
        return normalizedPlanId === normalizedAlias || normalizedPlanId.indexOf(normalizedAlias) !== -1;
      });
    }) || null;
  }

  function getPlanName(subscription){
    if(subscription && subscription.user_id === 'beta'){
      return 'Beta Access';
    }
    var plan = inferPlan(subscription && subscription.plan_id, subscription && subscription.price_id);
    return plan ? plan.name : 'No Active Plan';
  }

  function getAccessLevel(subscription){
    if(dashboardAccessOverride){
      return 'beta';
    }
    if(subscription && subscription.user_id === 'beta'){
      return 'beta';
    }
    var plan = inferPlan(subscription && subscription.plan_id, subscription && subscription.price_id);
    return plan ? plan.id : 'none';
  }

  function hasAccess(subscription, requiredPlan){
    if(dashboardAccessOverride){
      return true;
    }
    if(subscription && subscription.user_id === 'beta'){
      return true;
    }
    var status = normalize(subscription && subscription.status);
    if(['active', 'trialing'].indexOf(status) === -1){
      return false;
    }
    var current = getAccessLevel(subscription);
    return (planRank[current] || 0) >= (planRank[requiredPlan] || 0);
  }

  return {
    plans: plans,
    dashboardAccessOverride: dashboardAccessOverride,
    lockedTabs: lockedTabs,
    getPlanByPriceId: getPlanByPriceId,
    inferPlan: inferPlan,
    getPlanName: getPlanName,
    getAccessLevel: getAccessLevel,
    hasAccess: hasAccess
  };
})();
