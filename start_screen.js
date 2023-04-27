// Welcome screen for Fruit Ninja
// AUTHORS: Alexander Flores Sosa and Edwin Cojitambo

/**
 * Once the user clicks the play button, the difficulty chosen is saved through local
 * storage, and used in the game file
 */
window.addEventListener('load', function init() {
    document.getElementById('start-game').addEventListener("click", function () {
        let difficulty = document.getElementById('difficulty').value
        localStorage.setItem("userDifficulty", difficulty)
    })
});