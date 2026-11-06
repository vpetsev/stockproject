const txtStock = document.getElementById("txtStock")
const cardStocks = document.getElementById("cardStocks")
const stockData = document.getElementById("stockData")
const searchButton = document.getElementById("searchButton")
const mainStocks = document.getElementById("stocksMain")
const infoType = document.getElementById("info-type")
const cardGroup = document.getElementById("card-group")

let userWatchlist = null
let watchlistCallback = null
let watchlistGeneration = 0

firebase.auth().onAuthStateChanged(function (user) {
    if (userWatchlist && watchlistCallback) userWatchlist.off("value", watchlistCallback)
    userWatchlist = null
    ++watchlistGeneration
    if (cardGroup) cardGroup.innerHTML = ""
    if (!user) {
        if (cardGroup) cardGroup.textContent = "Sign in to view your watchlist."
        return
    }
    userWatchlist = rootRef.child("users").child(user.uid)
    // Each account owns a separate subscription; never read the shared /users node.
    watchlistCallback = function (snapshot) {
        if (!firebase.auth().currentUser || firebase.auth().currentUser.uid !== user.uid) return
        const value = snapshot.val() || {}
        const stocks = Object.values(value.watchlist || {}).filter(item => item && typeof item.stock === "string")
        if (value.stock && !stocks.some(item => item.stock === value.stock)) stocks.push({ stock: value.stock })
        if (cardGroup) cardGroup.innerHTML = ""
        loadWatchlistedStocks(stocks, ++watchlistGeneration)
    }
    userWatchlist.on("value", watchlistCallback, function () {
        if (cardGroup) cardGroup.textContent = "Unable to load your watchlist."
    })
})

function loadWatchlistedStocks(array, generation = watchlistGeneration) {
    if (!Array.isArray(array) || array.length === 0) {
        if (cardGroup) cardGroup.textContent = "Your watchlist is empty."
        return
    }
    for (const item of array) {
        const symbol = item && item.stock
        if (typeof symbol !== 'string' || !/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(symbol)) continue
        fetch(
            `https://sandbox.iexapis.com/stable/stock/${encodeURIComponent(symbol)}/chart/dynamic?token=Tsk_f505cc8d1a8e429e9f06fc365bb67dbb`
        ).then(response => response.json()).then(allInfo => {
            if (generation !== watchlistGeneration) return
            return cardPopulatorAfterHours(Object.values(allInfo), symbol, generation)
        }).catch(() => {
            if (generation === watchlistGeneration && cardGroup) cardGroup.textContent = "Unable to load stock data."
        })
    }
}

function cardPopulatorAfterHours(allData, symbol, generation = watchlistGeneration) {
    const rows = allData.find(Array.isArray) || []
    const mostRecent = rows[rows.length - 1]
    if (!mostRecent) return
    return fetch(
        `https://sandbox.iexapis.com/stable/stock/${symbol}/company?token=Tsk_f505cc8d1a8e429e9f06fc365bb67dbb`
    ).then(response => response.json()).then((companyInfo) => {
        let text =
            `
            <div class="card">
                <img class="card-img-top" src="images/candlestick-graph-slanting-right.jpg" alt="Card image cap">
                <button type="button" class="btn btn-block btn-dark mw-100" onclick='addToWatchlist("${symbol}")'>Add to watchlist 
                    <img src="/images/plus-square.svg" alt="" width="32" height="32" title="Bootstrap">
                </button>
                <div class="bg-secondary card-body">
                    <h4 class="card-title">
                    ${companyInfo.companyName} <small class="card-text">(${companyInfo.symbol})</small> </h4>
                    <div class="card-body" style="border-top-left-radius: 20px; border-top-right-radius: 20px; text-align: left;">
                        <li class="list-group-item">
                            High: $${mostRecent.high}
                            <span> </span>
                        </li>
                        <li class="list-group-item">
                            Low: $${mostRecent.low}
                            <span> </span>
                        </li>
                        <li class="list-group-item">
                            Close: $${mostRecent.close}
                            <span> </span>
                        </li>
                        <li class="list-group-item">
                            Volume: ${mostRecent.volume} Units
                            <span> </span>
                        </li>
                        <li class="list-group-item">
                            Date: ${mostRecent.date}
                            <span> </span>
                        </li>
                    </div>
                </div>
                <button type="button" class="btn btn-block btn-dark mw-100 see-more text-white" onclick='seeMoreInfo("${symbol}")'>
                    See More Info
                </button>
                <div class="card-footer m-0 p-0">
                    <ul class="m-0 pb-0 pr-0 pt-0">
                        <li>
                            <small class="text-muted" style="color: black!important;">Last updated: ${mostRecent.label} ${mostRecent.date}</small>
                        </li>
                        <li class="mt-n2">
                            <small class="text-muted" style="color: black!important;"> Stock information provided by IEXCloud"</small>
                        </li>
                </div>
            </div>
                        `
        if (cardGroup != null && generation === watchlistGeneration) {
            cardGroup.innerHTML += text
        }
    })
}

function addToWatchlist(symbol) {
    const currentUser = firebase.auth().currentUser
    if (!currentUser) {
        location.href = "/login.html"
        return Promise.resolve(false)
    }
    symbol = String(symbol).trim().toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(symbol)) return Promise.resolve(false)
    const key = encodeURIComponent(symbol).replace(/\./g, "%2E")
    return firebase.database().ref('users/' + currentUser.uid + '/watchlist/' + key).set({stock:symbol}).then(() => {
        if (location.pathname !== "/watchlist.html") location.href = "/watchlist.html"
        return true
    }).catch(() => {
        if (cardGroup) cardGroup.textContent = "Unable to save this stock. Please try again."
        return false
    })
}

function seeMoreInfo(symbol) {
    sessionStorage.setItem("dataStored", symbol)
    let mySymbol = sessionStorage.getItem("dataStored")
    console.log(mySymbol)
    location.href = "/stock-info.html"
}

// DELETE FUNCTION AND CLEARING WATCHLIST
// function deleteStockx() {
//     rootRefx.child("Watchlist").remove()
//     console.log("fired")
// }
// NOTE: Not added yet
// let clearWatchlist = document.getElementById("clearWatchlist")
// clearWatchlist.addEventListener("click", function () {
//     deleteStockx()
//     cardStocksw.innerHTML = ""
//     window.alert("Watchlist Sucessfully Cleared!")
// })