// Fruit Ninja Game using WebGL
// AUTHORS: Alexander Flores Sosa and Edwin Cojitambo
'use strict';
    
// Global WebGL context variable
let gl;

const mat4 = glMatrix.mat4

// Once the document is fully loaded run this init function.
window.addEventListener('load', function init() {
    // Get the HTML5 canvas object from it's ID
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) { window.alert('Could not find #webgl-canvas'); return; }

    // Get the WebGL context (save into a global variable)
    gl = canvas.getContext('webgl2');
    if (!gl) { window.alert("WebGL isn't available"); return; }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height); // this is the region of the canvas we want to draw on (all of it)
    gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color
    
    // Initialize the WebGL program and data
    gl.program = initProgram();
    initEvents();

    // Load models and wait for them all to complete
    Promise.all([
        loadModel('fruits/banana/scaled_banana/banana_scaled.json'),
    ]).then(
        models => {
            // All models have now fully loaded
            // Now we can add user interaction events and render the scene
            // The provided models is an array of all of the loaded models
            // Each model is a VAO and a number of indices to draw
            gl.models = models;
            onWindowResize();
            render();
        }
    );

    // Set initial values of uniforms
    gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, mat4.create());
});


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
        // any other attributes?

        // Vectors (varying variables to vertex shader)
        out vec3 vNormalVector;
        out vec3 vLightVector;
        out vec3 vEyeVector;

        void main() {
            vec4 P = uModelViewMatrix * aPosition;

            vNormalVector = mat3(uModelViewMatrix) * aNormal;
            vLightVector = light.w == 1.0 ? P.xyz - light.xyz : light.xyz;
            vEyeVector = -P.xyz;

            gl_Position =  P;
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
			vec4 color = materialColor;

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

    // Get uniforms
    program.uModelViewMatrix = gl.getUniformLocation(program, 'uModelViewMatrix');
    program.uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');

    return program;
}

/**
 * Load a model from a file into a VAO and return the VAO.
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
 * Initialize event handlers
 */
function initEvents() {
    window.addEventListener('resize', onWindowResize)

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
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (let [vao, count] of gl.models) {
        gl.bindVertexArray(vao);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    }

    // cleanup
    gl.bindVertexArray(null)
}