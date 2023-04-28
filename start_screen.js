// Welcome screen for Fruit Ninja
// AUTHORS: Alexander Flores Sosa and Edwin Cojitambo

// Game audio
let audio = new Audio('fruit_acapella.mp3');

// Lower the default game audio
audio.volume = 0.1;

/**
 * Once the user clicks the play button, the difficulty chosen is saved through local
 * storage, and used in the game file
 */
window.addEventListener('load', function init() {
    document.getElementById('start-game').addEventListener("click", function () {
        let difficulty = document.getElementById('difficulty').value
        localStorage.setItem("userDifficulty", difficulty)
    })

    // Initialize events
    initEvents();

});

/**
 * Setup the user-interaction events.
 */
function initEvents() {
    document.getElementById('music').addEventListener('change', pauseOrPlayMusic);
}

/**
 * Plays or pauses music depending on the music checkbox
 */
function pauseOrPlayMusic() {
    if (document.getElementById("music").checked) {
        audio.play();
    } else {
        audio.pause();
    }
}