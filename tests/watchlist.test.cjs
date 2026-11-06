const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function watchlist(data = {}, provider = null) {
  const calls = [], elements = {}, auth = {currentUser:null};
  let authChanged;
  auth.onAuthStateChanged = callback => { authChanged = callback; };
  const ref = (parts = []) => ({
    child(key) { return ref(parts.concat(key)); },
    on(event,callback) {
      calls.push({read:parts.join('/')});
      callback({val:() => parts.reduce((value,key) => value && value[key],data) || null});
    },
    off() { calls.push({unsubscribe:parts.join('/')}); },
    set(value) {
      let node = data;
      for (const part of parts.slice(0,-1)) node = node[part] ||= {};
      node[parts.at(-1)] = value;
      calls.push({write:parts.join('/')});
      return Promise.resolve();
    }
  });
  const ctx = vm.createContext({
    console, Promise, document:{getElementById:id => elements[id] ||= {innerHTML:'',textContent:''}},
    rootRef:ref(), firebase:{auth:() => auth,database:() => ({ref:p => ref(p.split('/'))})},
    location:{pathname:'/watchlist.html',href:'/watchlist.html'},
    fetch:async url => { calls.push({symbol:url.match(/\/stock\/([^/]+)/)[1]}); return provider ? provider(url) : {json:async () => ({range:'fixture'})}; }
  });
  vm.runInContext(source('assets/js/watchlist.js'),ctx);
  return {ctx,calls,data,elements,signIn(user) { auth.currentUser=user;authChanged(user); }};
}

test('subscriptions wait for authentication and read only the signed-in user', async () => {
  const fixture = watchlist({users:{alice:{watchlist:{AAPL:{stock:'AAPL'}}},bob:{watchlist:{MSFT:{stock:'MSFT'}}}}});
  assert.equal(fixture.calls.length,0);
  fixture.signIn({uid:'alice'});
  await tick();
  assert.deepEqual(fixture.calls.filter(x=>x.read).map(x=>x.read),['users/alice']);
  assert.deepEqual(fixture.calls.filter(x=>x.symbol).map(x=>x.symbol),['AAPL']);
  fixture.signIn({uid:'bob'});
  await tick();
  assert(fixture.calls.some(x=>x.unsubscribe==='users/alice'));
  fixture.signIn(null);
  assert.match(fixture.elements['card-group'].textContent,/Sign in/);
});

test('empty snapshots work and adding symbols preserves other watchlist entries', async () => {
  const fixture = watchlist();
  fixture.signIn({uid:'alice'});
  assert.match(fixture.elements['card-group'].textContent,/empty/);
  assert.equal(await fixture.ctx.addToWatchlist('AAPL'),true);
  assert.equal(await fixture.ctx.addToWatchlist('MSFT'),true);
  assert.deepEqual(Object.keys(fixture.data.users.alice.watchlist).sort(),['AAPL','MSFT']);
  await fixture.ctx.addToWatchlist('BRK.B');
  assert.equal(fixture.data.users.alice.watchlist['BRK%2EB'].stock,'BRK.B');
  fixture.signIn(null);
  const writes = fixture.calls.filter(x=>x.write).length;
  assert.equal(await fixture.ctx.addToWatchlist('NVDA'),false);
  assert.equal(fixture.calls.filter(x=>x.write).length,writes);
});

test('existing single-stock data is still displayed', async () => {
  const fixture = watchlist({users:{alice:{stock:'AAPL'}}});
  fixture.signIn({uid:'alice'});
  await tick();
  assert(fixture.calls.some(x=>x.symbol==='AAPL'));
});

test('signup refuses mismatched passwords and handles provider errors without scope errors', async () => {
  assert.match(source('register.html'), /id="txtPassword2"/);
  const htmlIds = new Set([...source('register.html').matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
  const elements={},calls=[];
  const ctx=vm.createContext({console,Promise,document:{getElementById:id=>htmlIds.has(id) ? (elements[id] ||= {value:'',className:'',textContent:'',innerHTML:''}) : null},firebase:{initializeApp(){},database:()=>({ref:()=>({})}),auth:()=>({createUserWithEmailAndPassword:(email,password)=>{calls.push({email,password});return Promise.reject({code:'auth/weak-password',message:'Password too short'});}})},window:{setTimeout(){}}});
  vm.runInContext(source('assets/js/register.js'),ctx);
  elements.txtEmail.value='test@example.invalid';
  elements.txtPassword.value='first';elements.txtPassword2.value='second';
  await elements.btnSignUp.onclick({preventDefault(){}});
  assert.equal(calls.length,0);
  assert.match(elements['pwd-check'].textContent,/match/);
  elements.txtPassword2.value='first';
  await elements.btnSignUp.onclick({preventDefault(){}});
  assert.equal(calls.length,1);
  assert.equal(elements['pwd-check'].textContent,'Password too short');
});


test('signup success uses real markup status element and schedules one redirect', async () => {
  const htmlIds = new Set([...source('register.html').matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
  const elements = {}, redirects = [];
  const ctx = vm.createContext({
    console, Promise,
    document: { getElementById: id => htmlIds.has(id) ? (elements[id] ||= {value:'', className:'', textContent:'', innerHTML:''}) : null },
    firebase: { initializeApp(){}, database: () => ({ref: () => ({})}), auth: () => ({createUserWithEmailAndPassword: () => Promise.resolve({user: {uid: 'fixture'}})}) },
    window: { setTimeout(callback, delay) { redirects.push({callback, delay}); } }
  });
  vm.runInContext(source('assets/js/register.js'), ctx);
  elements.txtEmail.value = 'test@example.invalid';
  elements.txtPassword.value = elements.txtPassword2.value = 'test-password';
  await elements.btnSignUp.onclick({preventDefault(){}});
  assert.equal(elements.accountLogic.innerHTML, 'Account successfully created');
  assert.equal(redirects.length, 1);
  assert.equal(redirects[0].delay, 2000);
});


test('non-monthly chart ranges render and malformed saved items are ignored', async () => {
  const fixture = watchlist({users: {alice: {stock: 'AAPL', watchlist: {bad: null, malformed: {other: true}, AAPL: {stock: 'AAPL'}}}}}, async url => ({
    json: async () => url.includes('/company?')
      ? {companyName: 'Fixture Company', symbol: 'AAPL'}
      : {range: '1d', data: [{high: 10, low: 8, close: 9, volume: 100, date: '2026-11-05', label: 'Today'}]}
  }));
  fixture.signIn({uid: 'alice'});
  await tick();
  assert.deepEqual(fixture.calls.filter(call => call.symbol).map(call => call.symbol), ['AAPL', 'AAPL']);
  assert.match(fixture.elements['card-group'].innerHTML, /Fixture Company/);
});

test('company lookup failures show an error rather than an unhandled rejection', async () => {
  const fixture = watchlist({users: {alice: {watchlist: {AAPL: {stock: 'AAPL'}}}}}, async url => {
    if (url.includes('/company?')) throw new Error('fixture provider unavailable');
    return {json: async () => ({range: '1d', data: [{close: 9}]})};
  });
  fixture.signIn({uid: 'alice'});
  await tick();
  assert.match(fixture.elements['card-group'].textContent, /Unable to load stock data/);
});
