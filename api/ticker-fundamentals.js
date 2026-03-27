module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const ticker = (url.searchParams.get('ticker') || '').replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
    const timeframe = url.searchParams.get('timeframe') || 'quarterly';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '8', 10), 20);
    const apiKey = process.env.MASSIVE_API_KEY || process.env.MASSIVE_API || process.env.POLYGON_API_KEY || '';

    if (!ticker) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Missing ticker' }));
      return;
    }

    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'API key not configured' }));
      return;
    }

    const bsUrl = `https://api.polygon.io/stocks/financials/v1/balance-sheets?tickers=${encodeURIComponent(ticker)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}&sort=period_end.desc&apiKey=${encodeURIComponent(apiKey)}`;
    const bsRes = await fetch(bsUrl);

    if (!bsRes.ok) {
      const body = await bsRes.text().catch(() => '');
      res.statusCode = bsRes.status === 403 ? 403 : 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Balance sheet data unavailable', status: bsRes.status, detail: body.slice(0, 300) }));
      return;
    }

    const json = JSON.parse(await bsRes.text());
    const results = (json.results || []).map(r => ({
      period_end: r.period_end,
      filing_date: r.filing_date,
      fiscal_year: r.fiscal_year,
      fiscal_quarter: r.fiscal_quarter,
      timeframe: r.timeframe,
      // Assets
      total_assets: r.total_assets,
      total_current_assets: r.total_current_assets,
      cash_and_equivalents: r.cash_and_equivalents,
      short_term_investments: r.short_term_investments,
      receivables: r.receivables,
      inventories: r.inventories,
      other_current_assets: r.other_current_assets,
      property_plant_equipment_net: r.property_plant_equipment_net,
      goodwill: r.goodwill,
      intangible_assets_net: r.intangible_assets_net,
      other_assets: r.other_assets,
      // Liabilities
      total_liabilities: r.total_liabilities,
      total_current_liabilities: r.total_current_liabilities,
      accounts_payable: r.accounts_payable,
      accrued_and_other_current_liabilities: r.accrued_and_other_current_liabilities,
      debt_current: r.debt_current,
      deferred_revenue_current: r.deferred_revenue_current,
      long_term_debt_and_capital_lease_obligations: r.long_term_debt_and_capital_lease_obligations,
      other_noncurrent_liabilities: r.other_noncurrent_liabilities,
      // Equity
      total_equity: r.total_equity,
      total_equity_attributable_to_parent: r.total_equity_attributable_to_parent,
      common_stock: r.common_stock,
      additional_paid_in_capital: r.additional_paid_in_capital,
      retained_earnings_deficit: r.retained_earnings_deficit,
      accumulated_other_comprehensive_income: r.accumulated_other_comprehensive_income,
      treasury_stock: r.treasury_stock,
      noncontrolling_interest: r.noncontrolling_interest,
      total_liabilities_and_equity: r.total_liabilities_and_equity
    }));

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.statusCode = 200;
    res.end(JSON.stringify({ ticker, results }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Unknown error' }));
  }
};
