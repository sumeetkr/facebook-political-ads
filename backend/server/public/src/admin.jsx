import { h, render } from 'preact';
import { applyMiddleware, compose, combineReducers, createStore } from 'redux';
import thunkMiddleware from 'redux-thunk';
import persistState from 'redux-localstorage';
import { Provider, connect } from 'preact-redux';
import { createLogger } from 'redux-logger';

const NEW_ADS = "new_ads";
const HIDE_AD = "hide_ad";
const LOGIN = "login";

const auth = (credentials) => credentials ? new Headers({"Authorization": `Bearer ${credentials.token}`}) : null;

const b64 = (thing) => btoa(thing).replace('+', '-').replace('_', '/').replace(/=+/, '');
const createJWT = (password) => {
  const encoder = new TextEncoder();
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const payload = {
    username: "" // TODO: Fix me
  };
  const base = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(payload))}`;
  const encoded = encoder.encode(base);
  return window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    {name: "HMAC", hash: {name: "SHA-256"}},
    false,
    ["sign"]
  ).then(key => window.crypto.subtle.sign({name: 'HMAC'}, key, encoded))
    .then(signature => `${base}.${b64(String.fromCharCode.apply(null, new Uint8Array(signature)))}`);
};

const hideAd = (ad) => ({
  type: HIDE_AD,
  id: ad.id
});

const refresh = (getState) => fetch("/facebook-ads/ads", {
  method: "GET",
  headers: auth(getState().credentials)
}).then((res) => res.json())
  .then((ads) => store.dispatch(newAds(ads)));

const suppressAd = (ad) => {
  return (dispatch, getState) => {
    dispatch(hideAd(ad));
    return fetch("/facebook-ads/admin/ads", {
      method: "POST",
      body: ad.id,
      headers: auth(getState().credentials)
    }).then((resp) => {
      if(resp.ok) {
        console.log("suppressed");
      }
    });
  };
};

const newAds = (ads) => ({
  type: NEW_ADS,
  value: ads
});

const login = (credentials) => ({
  type: LOGIN,
  value: credentials
});

const authorize = (username, password) => {
  // create jwt
  return (dispatch, getState) => createJWT(username, password).then(token => {
    return fetch("/facebook-ads/login", {
      method: "POST",
      headers: new Headers({
        "Authorization": `Bearer ${token}`
      })
    }).then((resp) => {
      if(resp.ok) {
        dispatch(login({token: token}));
      }
    });
  });
};

const credentials = (state = {}, action) => {
  switch(action.type) {
  case LOGIN:
    return action.value;
  default:
    return state;
  }
};

const ads = (state = [], action) => {
  switch(action.type) {
  case NEW_ADS:
    return action.value;
  case HIDE_AD:
    return state.map(ad => {
      if(ad.id === action.id) {
        return { ...ad, suppressed: true };
      }
      return ad;
    });
  default:
    return state;
  }
};

const reducer = combineReducers({
  credentials,
  ads,
});
const middleware = [thunkMiddleware, createLogger()];
const store = createStore(reducer, compose(...[persistState(), applyMiddleware(...middleware)]));

let Login = ({onLogin}) => (
  <form id="login" onSubmit={onLogin} >
    <input id="password" type="password" placeholder="password" />
    <input id="submit" type="submit" value="login" />
  </form>
);
Login = connect(
  (state) => state,
  (dispatch) => ({
    onLogin: (e) => {
      e.preventDefault();
      dispatch(authorize(
        e.target.querySelector("#password").value
      ));
    }
  })
)(Login);

const Ad = ({ad, onClick}) => (
  <div className="ad">
    <table>
      <tr>
        <td>id</td>
        <td>{ad.id}</td>
      </tr>
      <tr>
        <td>title</td>
        <td>{ad.title}</td>
      </tr>
      <tr>
        <td>text</td>
        <td dangerouslySetInnerHTML={{__html: ad.html}} />
      </tr>
      <tr>
        <td colSpan="2">
          {ad.suppressed ? "Suppressed" :
            <button onClick={function() { return onClick(ad); }}>
              Suppress
            </button>}
        </td>
      </tr>
    </table>
  </div>
);

let Ads = ({ads, onClick}) => (
  <div id="ads">
    {ads.map((ad) => <Ad ad={ad} key={ad.id} onClick={onClick} />)}
  </div>
);
Ads = connect(
  (state) => ({
    ads: state.ads.filter((ad) => !ad.suppressed)
  }),
  (dispatch) => ({
    onClick: (ad) => dispatch(suppressAd(ad))
  })
)(Ads);

let App = ({credentials}) => (
  <div id="app">
    {credentials && credentials.token ? <Ads /> : <Login />}
  </div>
);
App = connect((state) => state)(App);

render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.body
);
refresh(store.getState);
