const firebaseConfig = {
    apiKey: "AIzaSyBz83kqwVu8gWrGAjkitG3sh5VtbWfbG2U",
    authDomain: "stock-a30ff.firebaseapp.com",
    databaseURL: "https://stock-a30ff.firebaseio.com",
    projectId: "stock-a30ff",
    storageBucket: "stock-a30ff.appspot.com",
    messagingSenderId: "628920247502",
    appId: "1:628920247502:web:93439270d44745fc435c9f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get elements
const txtEmail = document.getElementById("txtEmail");
const txtPassword = document.getElementById("txtPassword");
const txtPassword2 = document.getElementById("txtPassword2");
const accountLogic = document.getElementById("accountLogic")

// div elements
const emailCheck = document.getElementById("email-check");
const pwdCheck = document.getElementById("pwd-check")
const database = firebase.database()

let rootRef = database.ref()
let auth = firebase.auth()

document.getElementById("btnSignUp").onclick = function (event) {
    if (event) event.preventDefault()
    const email = txtEmail.value
    const pass = txtPassword.value
    const rptPass = txtPassword2.value
    if (pass !== rptPass) {
        txtPassword2.className += " is-invalid"
        pwdCheck.className = "invalid-feedback d-block"
        pwdCheck.textContent = "Passwords must match."
        return Promise.resolve(false)
    }
    return signUp(email, pass)
};

function signUp(email, password) {
    return firebase.auth().createUserWithEmailAndPassword(email, password).then(e => {
        console.log("then fired")
        accountLogic.innerHTML = "Account successfully created"
        window.setTimeout(() => window.location.href = "index.html", 2000)
    }).catch(function (error) {
        var errorMessage = error.message;
        if ((/(email)+/g).test(errorMessage)) {
            console.log("email error")
            console.log(errorMessage)
            txtEmail.className += " is-invalid"
            emailCheck.className = "invalid-feedback"
            emailCheck.textContent = error.message
        } else {
            console.log(error.code + error.message)
            txtPassword.className += " is-invalid"
            pwdCheck.className = "invalid-feedback d-block"
            pwdCheck.textContent = error.message
        }
    })
}
// Add a realtime listener - logout button hiding
// firebase.auth().onAuthStateChanged(firebaseUser => {
//     if (firebaseUser) {
//         console.log(firebaseUser);
//         btnLogout.classList.remove("hide");
//     } else {
//         console.log("not logged in");
//         btnLogout.classList.add("hide");
//     }
// });
// rootRef.on('value', (snapshot) => {
//     snapshotValue = snapshot.val()
//     console.log(snapshotValue)
// })
// function logout() {
//     firebase.auth().signOut()
//         .then(function () {
//             alert("user signed out")
//         })
//         .catch(function (error) {
//             alert("Something went wrong")
//         })
// }