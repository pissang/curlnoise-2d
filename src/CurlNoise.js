import Pass from 'claygl/src/compositor/Pass';
import Mesh from 'claygl/src/Mesh';
import Material from 'claygl/src/Material';
import Shader from 'claygl/src/Shader';
import Texture2D from 'claygl/src/Texture2D';
import Texture from 'claygl/src/Texture';
import OrthoCamera from 'claygl/src/camera/Orthographic';
import PlaneGeometry from 'claygl/src/geometry/Plane';
import Line2DGeometry from './Line2D';

import FrameBuffer from 'claygl/src/FrameBuffer';

import isMobile from './isMobile';


import vectorFieldParticleGLSL from './curlnoise.glsl';

Shader['import'](vectorFieldParticleGLSL);

function createSpriteCanvas(size) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
}
function CurlNoise () {

    this.motionBlurFactor = 0.995;
    this.particleLife = [5, 15];
    this.particleSpeedScaling = 1;
    /**
     * @type {Array.<number>}
     */
    this.particleColor = [1, 1, 1, 1];

    var parameters = {
        type: isMobile ? Texture.HALF_FLOAT : Texture.FLOAT,
        minFilter: Texture.NEAREST,
        magFilter: Texture.NEAREST,
        useMipmap: false
    };
    this.spawnTexture = new Texture2D(parameters);
    this.spawnTexture.type = Texture.FLOAT;

    this.noiseTexture = new Texture2D(Object.assign({
        width: 256,
        height: 256,
        wrapS: Texture.CLAMP_TO_EDGE,
        wrapT: Texture.CLAMP_TO_EDGE
    }, parameters));

    this._posTexture0 = new Texture2D(parameters);
    this._posTexture1 = new Texture2D(parameters);

    this._frameBuffer = new FrameBuffer({
        depthBuffer: false
    });
    this._noisePass = new Pass({
        fragment: Shader.source('curl.noise')
    });
    this._particlePass = new Pass({
        fragment: Shader.source('curl.updateParticle')
    });

    this._downsamplePass = new Pass({
        fragment: Shader.source('curl.downsample')
    });

    this._outputPass = new Pass({
        fragment: Shader.source('curl.output'),
        blendWithPrevious: true
    });

    var particleLinesMesh = new Mesh({
        // Render after last frame full quad
        renderOrder: 10,
        material: new Material({
            shader: new Shader(
                Shader.source('curl.renderLines.vertex'),
                Shader.source('curl.renderLines.fragment')
            )
        }),
        geometry: new Line2DGeometry(),
        culling: false
    });

    var quadShader = new Shader(
        Shader.source('clay.compositor.vertex'),
        Shader.source('curl.output')
    );
    var lastFrameFullQuad = new Mesh({
        material: new Material({
            shader: quadShader
        }),
        geometry: new PlaneGeometry()
    });

    this._particleLinesMesh = particleLinesMesh;
    this._lastFrameFullQuadMesh = lastFrameFullQuad;

    this._camera = new OrthoCamera();
    this._thisFrameTexture = new Texture2D();
    this._lastFrameTexture = new Texture2D();

    this._frame = 0;

    this._elapsedTime = 0;

    this._downsampleTextures = [];
};

CurlNoise.prototype = {

    constructor: CurlNoise,


    setParticleDensity: function (size) {
        this._setLineGeometry(size, size);

        this._posTexture0.width = this._posTexture1.width = size;
        this._posTexture0.height = this._posTexture1.height = size;

        this._noisePass.setUniform('textureSize', [size, size]);
    },

    generateSpawnTexture: function (size) {
        var nVertex = size * size;
        var spawnTextureData = new Float32Array(nVertex * 4);
        var off = 0;
        var lifeRange = this.particleLife;
        if (typeof lifeRange === 'number') {
            lifeRange = [lifeRange, lifeRange];
        }

        var k = 0;
        for (var i = 0; i < size; i++) {
            for (var j = 0; j < size; j++, off++) {
                // x position, range [0 - 1]
                spawnTextureData[off * 4] = Math.random();
                // y position, range [0 - 2]
                spawnTextureData[off * 4 + 1] = Math.random();
                spawnTextureData[off * 4 + 2] = 0;
                var life = (lifeRange[1] - lifeRange[0]) * Math.random() + lifeRange[0];
                // Particle life
                spawnTextureData[off * 4 + 3] = life;
            }
        }

        var spawnTexture = this.spawnTexture;
        spawnTexture.width = size;
        spawnTexture.height = size;
        spawnTexture.pixels = spawnTextureData;
        spawnTexture.dirty();
    },

    _setLineGeometry: function (width, height) {
        var nLine = width * height;
        var geometry = this._getParticleMesh().geometry;
        geometry.setLineCount(nLine);
        geometry.resetOffset();
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++) {
                geometry.addLine([i / width, j / height]);
            }
        }
        geometry.dirty();
    },


    _getParticleMesh: function () {
        return this._particleLinesMesh;
    },

    update: function (renderer, deltaTime) {
        deltaTime /= 1000;

        this._elapsedTime += deltaTime;

        var frame = this._frame;
        this._frame++;

        this.resize(renderer.getWidth(), renderer.getHeight());

        var particleMesh = this._getParticleMesh();
        var frameBuffer = this._frameBuffer;
        var noisePass = this._noisePass;
        var particlePass = this._particlePass;

        var firstFrame = frame === 0;

        if (firstFrame) {
            this._updateDownsampleTextures(renderer);
        }

        frameBuffer.bind(renderer);
        frameBuffer.attach(this.noiseTexture);
        noisePass.setUniform('elapsedTime', this._elapsedTime);
        noisePass.render(renderer);

        frameBuffer.attach(this._posTexture1);
        particlePass.setUniform('speedScaling', this.particleSpeedScaling);
        particlePass.setUniform('posTexture', this._posTexture0);
        particlePass.setUniform('noiseTexture', this.noiseTexture);
        particlePass.setUniform('spawnTexture', this.spawnTexture);
        particlePass.setUniform('deltaTime', deltaTime);
        particlePass.setUniform('firstFrame', firstFrame);
        particlePass.setUniform('noiseTextureSize', this.noiseTexture.width);
        particlePass.render(renderer);

        frameBuffer.attach(this._thisFrameTexture);
        renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT);
        this._camera.update(true);

        var lastFrameFullQuad = this._lastFrameFullQuadMesh;
        lastFrameFullQuad.material.set('texture', this._lastFrameTexture);
        lastFrameFullQuad.material.set('color', [1, 1, 1, this.motionBlurFactor]);

        particleMesh.material.set('size', this._particleSize * this._supersampling);
        particleMesh.material.set('color', this.particleColor);

        particleMesh.material.set('posTexture', this._posTexture1);
        particleMesh.material.set('prevPosTexture', this._posTexture0);

        renderer.renderPass([lastFrameFullQuad, particleMesh], this._camera);

        frameBuffer.unbind(renderer);

        this._downsample(renderer);

        this._swapTexture();

        this._elapsedTime += deltaTime;
    },

    output: function (renderer) {
        this._outputPass.setUniform('texture', this.getSurfaceTexture());
        this._outputPass.render(renderer);
    },

    _downsample: function (renderer) {
        var downsampleTextures = this._downsampleTextures;
        if (downsampleTextures.length === 0) {
            return;
        }
        var current = 0;
        var sourceTexture = this._thisFrameTexture;
        var targetTexture = downsampleTextures[current];

        while (targetTexture) {
            this._frameBuffer.attach(targetTexture);
            this._downsamplePass.setUniform('texture', sourceTexture);
            this._downsamplePass.setUniform('textureSize', [sourceTexture.width, sourceTexture.height]);
            this._downsamplePass.render(renderer, this._frameBuffer);

            sourceTexture = targetTexture;
            targetTexture = downsampleTextures[++current];
        }
    },

    getSurfaceTexture: function () {
        var downsampleTextures = this._downsampleTextures;
        return downsampleTextures.length > 0
            ? downsampleTextures[downsampleTextures.length - 1]
            : this._lastFrameTexture;
    },

    resize: function (width, height) {
        this._lastFrameTexture.width = width * this._supersampling;
        this._lastFrameTexture.height = height * this._supersampling;
        this._thisFrameTexture.width = width * this._supersampling;
        this._thisFrameTexture.height = height * this._supersampling;

        this._width = width;
        this._height = height;
    },

    setParticleSize: function (size) {
        var particleMesh = this._getParticleMesh();
        this._particleSize = size;
        if (size <= 2) {
            particleMesh.material.disableTexture('spriteTexture');
            particleMesh.material.transparent = false;
            return;
        }
        if (!this._spriteTexture) {
            this._spriteTexture = new Texture2D();
        }
        if (!this._spriteTexture.image || this._spriteTexture.image.width !== size) {
            this._spriteTexture.image = createSpriteCanvas(size);
            this._spriteTexture.dirty();
        }
        particleMesh.material.transparent = true;
        particleMesh.material.enableTexture('spriteTexture');
        particleMesh.material.set('spriteTexture', this._spriteTexture);

    },

    setGradientTexture: function (gradientTexture) {
        var material = this._getParticleMesh().material;
        material.setUniform('gradientTexture', gradientTexture);
    },

    clearFrame: function (renderer) {
        this._frame = 0;

        var frameBuffer = this._frameBuffer;
        frameBuffer.attach(this._lastFrameTexture);
        frameBuffer.bind(renderer);
        renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT);
        frameBuffer.unbind(renderer);
    },

    setSupersampling: function (supersampling) {
        this._supersampling = supersampling;
        this.resize(this._width, this._height);
    },

    _updateDownsampleTextures: function (renderer) {
        var downsampleTextures = this._downsampleTextures;
        var upScale = Math.max(Math.floor(Math.log(this._supersampling / renderer.getDevicePixelRatio()) / Math.log(2)), 0);
        var scale = 2;
        var width = this._width * this._supersampling;
        var height = this._height * this._supersampling;
        for (var i = 0; i < upScale; i++) {
            downsampleTextures[i] = downsampleTextures[i] || new Texture2D();
            downsampleTextures[i].width = width / scale;
            downsampleTextures[i].height = height / scale;
            scale *= 2;
        }
        for (;i < downsampleTextures.length; i++) {
            downsampleTextures[i].dispose(renderer);
        }
        downsampleTextures.length = upScale;
    },

    _swapTexture: function () {
        var tmp = this._posTexture0;
        this._posTexture0 = this._posTexture1;
        this._posTexture1 = tmp;

        var tmp = this._thisFrameTexture;
        this._thisFrameTexture = this._lastFrameTexture;
        this._lastFrameTexture = tmp;
    },

    dispose: function (renderer) {
        renderer.disposeFrameBuffer(this._frameBuffer);
        // Dispose textures
        renderer.disposeTexture(this.forceFieldTexture);
        renderer.disposeTexture(this.spawnTexture);
        renderer.disposeTexture(this._posTexture0);
        renderer.disposeTexture(this._posTexture1);
        renderer.disposeTexture(this._thisFrameTexture);
        renderer.disposeTexture(this._lastFrameTexture);

        renderer.disposeGeometry(this._particleLinesMesh.geometry);
        renderer.disposeGeometry(this._lastFrameFullQuadMesh.geometry);

        if (this._spriteTexture) {
            renderer.disposeTexture(this._spriteTexture);
        }

        this._downsamplePass.dispose(renderer);

        this._downsampleTextures.forEach(function (texture) {
            texture.dispose(renderer);
        });
    }
};

export default CurlNoise;