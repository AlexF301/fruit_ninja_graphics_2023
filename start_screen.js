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
    initEvents();


});

/**
 * Setup the user-interaction events.
 */
function initEvents() {
    document.getElementById('music').addEventListener('change', playMusic);
}

/**
 * Plays or pauses music depending on the music checkbox
 */
function playMusic() {
    let audio = new Audio('fruit_acapella.mp3');
    audio.volume = 0.1;
    if (document.getElementById("music").checked) {
        audio.play();
    } else {
        audio.pause();
    }
}