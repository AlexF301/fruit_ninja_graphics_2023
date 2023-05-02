// AUTHORS: Alexander Flores Sosa and Edwin Cojitambo
'use strict';
    
// Global WebGL context variable
let gl;

const mat4 = glMatrix.mat4
const vec2 = glMatrix.vec2

let modelViewMatrix = mat4.create()

// Saves the references to each objected with nested attributes
// ex : { "banana", { obj: [vao, ind.length, texture] position: [x, y], randXPos: x , spawnTime: ms, lastSavedTime: ms, willBeTop: boolean, clicked: boolean, sizeDimen: [x, y]}
let objects = new Map()

// user difficulty
let difficulty = localStorage.getItem("userDifficulty")
// Game audio
let audio = new Audio('posty.mp3');

// Lower the default game audio
audio.volume = 0.1;

// Speed of objects moving in ms. Bigger the speed the slower the fruit goes. Default of 5000
let speedFactor = 5000

// Save calculation of object sizing, this happens before the objects map gets created. Stored in same order as the map
let objectSize = []

// Once the document is fully loaded run this init function.
window.addEventListener('load', function init() {
    // Get the HTML5 canvas object from it's ID
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) { window.alert('Could not find #webgl-canvas'); return; }

    // Get the WebGL context (save into a global variable)
    gl = canvas.getContext('webgl2');
    if (!gl) { window.alert("WebGL isn't available"); return; }
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND)

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height); // this is the region of the canvas we want to draw on (all of it)
    gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color
    
    // Initialize the WebGL program and data
    gl.program = initProgram();
    initEvents();
    let fruit_models = initModels();
    setDifficulty()

    // Set initial values of uniforms
    gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, mat4.create());
    gl.uniform1i(gl.program.uTexture, 0)

    // Load models and wait for them all to complete
    Promise.all(fruit_models).then(
        models => {
            // All models have now fully loaded
            // Now we can add user interaction events and render the scene
            // The provided models is an array of all of the loaded models
            // Each model is a VAO a number of indices to draw, and texture   
            for (let i = 0; i < models.length; i++) {
                let nestedMap = new Map();
                nestedMap.set("obj", models[i]);
                nestedMap.set("willBeTop", isTop());
                nestedMap.set("lastSavedTime",  0.0)
                nestedMap.set('sizeDimen', objectSize[i])
                let fruitName
                if (i === 0) {
                    fruitName = "banana"
                } else if (i === 1) {
                    fruitName = "apple"
                } else if (i === 2) {
                    fruitName = "watermelon"
                } else if (i === 3) {
                    fruitName = "bomb"
                }
                nestedMap.set("fruitName", fruitName)
                
                let fruit_obj = `obj` + (i+1)
                objects.set(fruit_obj, nestedMap);

                // generate random x positions for fruits between (-1.0 to 1.0)
                generateRandomsXPositions(objects.get(fruit_obj));
                // generate random spawn time for fruits
                generateRandomSpawnTime(objects.get(fruit_obj))   
            }            
            onWindowResize();
            render()
        }
    );
    // set initial lives of user (TODO: Replace based on difficulty)
    let lives = document.getElementById('lives')
    lives.value = 3

    // set initial score of user
    let score = document.getElementById('score')
    score.value = 0
});

/**
 * Sets the difficulty of the game based off the user's selection from the welcome screen 
 */
function setDifficulty() {
    if (difficulty === "NORMAL") {
        speedFactor = 2500
    } else if (difficulty === "HARD") {
        speedFactor = 1000
    }
}

/**
 * Initalizes the models to be used during the game togeher with their textures
 * 
 * @returns the array of models to load
 */
function initModels() {
    let banana = loadModelWithTexture('fruits/banana/scaled_banana/banana_scaled.json', 'fruits/banana/original_banana/textures/Banana_skin_texture.jpg', 0)
    let apple = loadModelWithTexture('fruits/apple/apple.json', 'fruits/apple/apple-photogrammetry/textures/Apple_albedo.jpeg', 1)
    let watermelon = loadModelWithTexture('fruits/watermelon-fresh/Watermelon.json', 'fruits/watermelon-fresh/textures/food_0001_color_2k.jpeg', 2)
    let bomb = loadModelWithTexture('bomb/bomb.json', 'bomb/textures/bomb_basecol.png', 3)
    return [banana, apple, watermelon, bomb];
}

/**
 * Loads the the models togehter with their textures
 * 
 * @param model : the file of the model to load
 * @param img_path : the texture file to load along with the model
 * @param index : index to hold texture
 * @returns an array holding reference to the [vao, indices.length, texture]
 */
function loadModelWithTexture(model, img_path, index) {
    let image = new Image();
    image.src = img_path;

    return new Promise((resolve) => {
        loadModel(model)
            .then(object => {
                if (image.complete) {
                    console.log("resolving")
                    object.push(loadTexture(image, index));
                    resolve(object); // Resolve the promise with the object including the texture
                } else {
                    console.log("will resolve")
                    image.addEventListener('load', () => {
                        console.log("resolving")
                        object.push(loadTexture(image, index));
                        resolve(object); // Resolve the promise with the object including the texture
                    });
                }
            })
            .catch(error => console.error(error)); // Log the error if any
    });
}


/**
 * Load a texture onto the GPU. The second argument is the texture number, defaulting to 0.
 */
function loadTexture(img, index=0) {
    let texture = gl.createTexture(); // create a texture resource on the GPU
    gl.activeTexture(gl['TEXTURE'+index]); // set the current texture that all following commands will apply to
    gl.bindTexture(gl.TEXTURE_2D, texture); // assign our texture resource as the current texture
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // tell WebGL to flip the image vertically (almost always want this to be true)
    // Load the image data into the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    // Setup options for downsampling and upsampling the image data
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Cleanup and return
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}


/**
 * Initializes the WebGL program.
 */
function initProgram() {
    // Compile shaders
    // Vertex Shader
    let vert_shader = compileShader(gl, gl.VERTEX_SHADER,
        `#version 300 es
        precision mediump float;

        // Matrices
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;

        // Light Position
        const vec4 light = vec4(0, 0, 5, 1);

        // Attributes for the vertex (from VBOs)
        in vec4 aPosition;
        in vec3 aNormal;
        in vec2 aTexCoord;

        // Vectors (varying variables to vertex shader)
        out vec3 vNormalVector;
        out vec3 vLightVector;
        out vec3 vEyeVector;

        // Texture information
        out vec2 vTexCoord;

        void main() {
            vec4 P = uModelViewMatrix * aPosition;

            vNormalVector = mat3(uModelViewMatrix) * aNormal;
            vLightVector = light.w == 1.0 ? P.xyz - light.xyz : light.xyz;
            vEyeVector = -P.xyz;

            gl_Position = P;

            vTexCoord = aTexCoord;
        }`
    );
    // Fragment Shader - Phong Shading and Reflections
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        // Light and material properties
        const vec3 lightColor = vec3(1, 1, 1);
        const vec4 materialColor = vec4(0, 0, 0, 1);
        const float materialAmbient = 0.2;
        const float materialDiffuse = 0.5;
        const float materialSpecular = 0.3;
        const float materialShininess = 10.0;

        // Vectors (varying variables from vertex shader)
        in vec3 vNormalVector;
        in vec3 vLightVector;
        in vec3 vEyeVector;

        // Texture information
        uniform sampler2D uTexture;
        in vec2 vTexCoord;

        // Output color
        out vec4 fragColor;

        void main() {
            // Normalize vectors
            vec3 N = normalize(vNormalVector);
            vec3 L = normalize(vLightVector);
            vec3 E = normalize(vEyeVector);

            // Compute lighting
            float diffuse = dot(-L, N);
            float specular = 0.0;
            if (diffuse < 0.0) {
                diffuse = 0.0;
            } else {
                vec3 R = reflect(L, N);
                specular = pow(max(dot(R, E), 0.0), materialShininess);
            }
            
            // Object color from texture
            vec4 color = texture(uTexture, vTexCoord) ;
            // vec4 color = materialColor;

            // Compute final color
            fragColor.rgb = lightColor * (
                (materialAmbient + materialDiffuse * diffuse) * color.rgb +
                materialSpecular * specular);
            fragColor.a = 1.0;
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Get the attribute indices
    program.aPosition = gl.getAttribLocation(program, 'aPosition'); // get the vertex shader attribute "aPosition"
    program.aColor = gl.getAttribLocation(program, 'aColor'); // get the vertex attribute color 
    program.aNormal = gl.getAttribLocation(program, 'aNormal'); // get the vertex attribute color 
    program.aTexCoord = gl.getAttribLocation(program, 'aTexCoord'); // get the vertex attribute color 

    // Get uniforms
    program.uModelViewMatrix = gl.getUniformLocation(program, 'uModelViewMatrix');
    program.uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');
    program.uTexture = gl.getUniformLocation(program, 'uTexture');

    return program;
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


/**
 * Load a model from a file into a VAO and return the VAO.
 * @param filename : the file to load
 */
function loadModel(filename) {
    return fetch(filename)
        .then(r => r.json())
        .then(raw_model => {
            // Create and bind the VAO
            let vao = gl.createVertexArray();
            gl.bindVertexArray(vao);
            
            // Load the vertex coordinate data onto the GPU and associate with attribute
            let positions = Float32Array.from(raw_model.vertices);

            calcObjectSize(positions)

            let posBuffer = gl.createBuffer(); // create a new buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer); // bind to the new buffer
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW); // load the data into the buffer
            gl.vertexAttribPointer(gl.program.aPosition, 3, gl.FLOAT, false, 0, 0); // associate the buffer with "aPosition" as length-2 vectors of floats
            gl.enableVertexAttribArray(gl.program.aPosition); // enable this set of data

            // Compute normals and load the data onto the GPU and associate with attribute
            let normals = calc_normals(positions, raw_model.indices, false);
            let normalBuffer = gl.createBuffer(); // create a new buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); // bind to the new buffer
            gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW); // load the data into the buffer
            gl.vertexAttribPointer(gl.program.aNormal, 3, gl.FLOAT, false, 0, 0); // associate the buffer with "aPosition" as length-2 vectors of floats
            gl.enableVertexAttribArray(gl.program.aNormal); // enable this set of data

            // Load the texture coordinate data into the GPU and associate with shader
            let texBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(raw_model.textureCoords), gl.STATIC_DRAW);
            gl.vertexAttribPointer(gl.program.aTexCoord, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(gl.program.aTexCoord);

            // Load the index data onto the GPU
            let indBuffer = gl.createBuffer(); // create a new buffer
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indBuffer); // bind to the new buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint16Array.from(raw_model.indices), gl.STATIC_DRAW); // load the data into the buffer
            
            // Cleanup
            gl.bindVertexArray(null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            // Return the VAO and number of indices
            return [vao, raw_model.indices.length];
        })
        .catch(console.error);
}

/**
 * Calculates the max of the x and y coordinates of an object. 
 * The values are pushed into the objectSize array which get added
 * to an obj (in the map) after the vao, indice length and texture loaded
 * 
 * @param vertices : the Float32Array of the model's vertices
 */
function calcObjectSize(vertices) {
    let xArray = []
    let yArray = []
    
    // skip over the z in vertices
    for (let i = 0; i < vertices.length; i+=3) {
        // x coordinates
        xArray.push(vertices[i])

        // y coordinates
        yArray.push(vertices[i+1])
    }
    // Get the max value of each positional array of x and y's
    let xOffset = Math.max(...xArray)
    let yOffset = Math.max(...yArray)
    // save the coordinates into the objectsSize list. 
    objectSize.push([xOffset, yOffset])
}

/**
 * Initialize event handlers
 */
function initEvents() {
    window.addEventListener('resize', onWindowResize)
    gl.canvas.addEventListener('mousedown', onMouseDown)
    document.getElementById('music').addEventListener('change', pauseOrPlayMusic);
}

/**
 * When the mouse is pressed down, move the mouse
 * @param e : the event object
 */
function onMouseDown(e) {
    e.preventDefault()
    gl.canvas.addEventListener('mousemove', onMouseMove)
}

// used to not slice bomb multiple times within milliseconds
let lastClickTime = 0;

/**
 * When the mouse is moved, uses clip coordiantes to check if the mouse has hovered over
 * an object on the canvas. This indicates that the object has been slashed through
 * 
 * @param e : the event object
 */
function onMouseMove(e) {
    e.preventDefault()
    // Get mouse x and y in clip coordinates
    let clipCoords = [2*e.offsetX/(gl.canvas.width-1)-1, 1-2*e.offsetY/(gl.canvas.height-1)];
    // current time of click (ms)
    let currentTime = performance.now()

    for (let fruit of objects.keys()) {
        let object = objects.get(fruit)
        let objPosition = object.get("position");
        let objSize = object.get('sizeDimen')

        // check if mouse coordinates are within range of an object
        if (withinRange(clipCoords, objPosition, objSize)) {
            // lose a life if bomb is sliced
            if (object.get("fruitName") === "bomb") {
                // stops issue of bomb lag
                if (currentTime - lastClickTime >= 500) {
                    let lives = document.getElementById('lives');
                    lives.value -= 1;
                    lives.innerHTML = lives.value
                    lastClickTime = Math.round(currentTime)
                    
                    // show lost life popup
                    lostLifePopup();
                }

            }
            object.set("clicked", true)
            generateRandomsXPositions(object)
            generateRandomSpawnTime(object)
            object.set("willBeTop", isTop())
        }
    }
    gl.canvas.addEventListener('mouseup', onMouseUp)
}

/**
 * When the mouse is released, remove the event listeners for mousemove and up
 * @param e : event
 */
function onMouseUp(e) {
    e.preventDefault()

    this.removeEventListener('mousemove', onMouseMove)
    this.removeEventListener('mouseup', onMouseUp);
}


/**
 * Creates a popup to alert user that they lost a life
 */
function lostLifePopup() {
    let lostLife = document.getElementById('lost-life')
    lostLife.style.display = 'block'
    setTimeout(() => {
        lostLife.style.display = 'none';
    }, 1000);
}


/**
 * check if clip coodinates are in the same range as objects position + size offset
 */
function withinRange(clipCoords, objPosition, objDimen) {
    let [clipX, clipY] = clipCoords
    let [posX, posY] = objPosition 
    let [offsetX, offsetY] = objDimen

    if (clipX > posX - offsetX && clipX < posX + offsetX &&
        clipY > posY - offsetY / 2 && clipY < posY + offsetY) {
        return true
    }
    return false
}
  
/**
 * Generates a random number -1 to 1 to be used for a fruits x position
 * 
 * @param fruit : the object to give a new x position to
 */
function generateRandomsXPositions(fruit) {
    fruit.set("randXPos", Math.random() * 2 - 1); // set the "randXPos" key for the nested map
}

/**
 * genereates a new spawn time/speed for an object
 * 
 * @param fruit the object to give a new spawn time/speed to
 */
function generateRandomSpawnTime(fruit) {
    let spawnTime = Math.random() * speedFactor; // generate a random spawn time
    let timeOffset = Math.random() * speedFactor; // generate a random time offset
    let speed = (spawnTime + timeOffset)
    let resetTime = speed * 3.75
    fruit.set("speed", speed)  
    fruit.set("resetTime",  resetTime)
}

/**
 * Generates a random number and uses it to decide if a fruit should spawn on top
 * of the screen or the bottom
 * 
 * @returns boolean indicating wheter an object should spawn from the top or bottom
 */
function isTop() {
    let randomY = Math.random();
    if (randomY > 0.5) {
        return true
    }
    return false
}

/**
 * Updates the x and y positions of an object
 * 
 * @param object : the object to save new positions to 
 * @param position : the new positions to save. an array of [x,y]
 */
function updateObjectPosition(object, position) {
    object.set('position', position)
}


/**
 * Moves the object across the screen
 * 
 * @param ms : time in milliseconds to animate objects
 * @param obj : the object to translate and rotate
 */
function moveObject(ms, obj) {
    mat4.identity(modelViewMatrix)

    let lives = document.getElementById('lives');
    let score = document.getElementById('score');
    let speed = obj.get('speed')
    let resetTime = obj.get('resetTime')
    // Keeps track of last saved time to use for resetting fruit
    let lastSavedTime = obj.get('lastSavedTime')
    let xPos = obj.get('randXPos')

    // Initial x and y position of fruit
    if (obj.get('willBeTop')) {
        glMatrix.mat4.translate(modelViewMatrix, modelViewMatrix, [xPos, 1.25, 0.0]); // initial position of fruit
        glMatrix.mat4.rotateY(modelViewMatrix, modelViewMatrix, (ms - lastSavedTime) / 1000); // rotates the y axis of the fruit
        glMatrix.mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, -((ms - lastSavedTime) / speed), 0.0]); // translated position 
    } else {
        glMatrix.mat4.translate(modelViewMatrix, modelViewMatrix, [xPos, -1.25, 0.0]); // initial position of fruit
        glMatrix.mat4.rotateY(modelViewMatrix, modelViewMatrix, (ms - lastSavedTime) / 1000); // rotates the y axis of the fruit
        glMatrix.mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, (ms - lastSavedTime) / speed, 0.0]); // translated position 
    }

    // save positions of each objecs. same order as objs
    let positions =  mat4.getTranslation(vec2.create(), modelViewMatrix);
    updateObjectPosition(obj, positions)

    // might have to round seconds to the nearest decimal point (or maybe don't convert ms to seconds)
    if (ms - lastSavedTime >= resetTime) { // resetTime is a ms value
        generateRandomsXPositions(obj)
        generateRandomSpawnTime(obj)
        obj.set('willBeTop', isTop());
        obj.set('lastSavedTime', ms);
        if (obj.get("fruitName") !== "bomb") {
            lives.value -= 1;
            lives.innerHTML = lives.value
        }
        console.log("fruit reset: ", obj.get("fruitName"))
    }
    // Increase score, and reset fruit that was clicked values
    if (obj.get('clicked')) {
        obj.set('clicked', false);
        obj.set('lastSavedTime', ms);
        score.value += 1;
        score.innerHTML = score.value
    }

    if (isGameOver()) {
        // Send user back to welcome screen and save their score
        localStorage.setItem("score", score.value)
        window.location.href = "start_screen.html"
    }

    // rotates the z axis of the fruit
    glMatrix.mat4.rotateZ(modelViewMatrix, modelViewMatrix, (ms - lastSavedTime) / 3000);

    // Updates in GPU
    gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, modelViewMatrix);
}


/**
 * Checks if lives has reached 0
 */
function isGameOver() {
    return document.getElementById('lives').value === 0
}

/**
 * Update the projection matrix.
 */
function updateProjectionMatrix() {
    let aspect = gl.canvas.width / gl.canvas.height;
    let p = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 10);
    gl.uniformMatrix4fv(gl.program.uProjectionMatrix, false, p);
}


/**
 * Keep the canvas sized to the window.
 */
function onWindowResize() {
    gl.canvas.width = window.innerWidth;
    gl.canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    updateProjectionMatrix();
}


/**
 * Render the scene
 */
function render(ms) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // The ms value is the number of miliseconds since some arbitrary time in the past
    // If it is not provided (i.e. render is directly called) then this if statement will grab the current time
    if (!ms) { ms = performance.now()}
    
    for (let fruitKey of objects.keys()) {
        let object = objects.get(fruitKey);
        let [vao, count, texture] = object.get("obj");
        gl.bindVertexArray(vao);
        moveObject(ms, object)
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);    
    }
    // cleanup
    gl.bindVertexArray(null)
    window.requestAnimationFrame(render);

}