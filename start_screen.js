// Welcome screen for Fruit Ninja
// AUTHORS: Alexander Flores Sosa and Edwin Cojitambo

/**
 * Once the user clicks the play button, the difficulty chosen is saved and passed
 * to the game logic through local storage
 */
window.addEventListener('load', function init() {
    document.getElementById('start-game').addEventListener("click", function () {
        let difficulty = document.getElementById('difficulty').value
        localStorage.setItem("userDifficulty", difficulty)
    })
});