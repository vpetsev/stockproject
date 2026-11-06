Run with Node.js 18 or later:
  node --test tests/*.test.cjs

Tests execute the original browser scripts with isolated DOM/Firebase/provider
fixtures. No live credentials, database writes, or stock API requests are used.

Watchlists now use users/<uid>/watchlist/<encoded-symbol>. Legacy single-stock
records at users/<uid>/stock remain readable. Firebase rules must independently
restrict reads/writes under users/<uid> to the matching authenticated user.
Client scoping does not replace server-side Firebase access rules.
