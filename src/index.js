import CurlNoise from './CurlNoise';
import Renderer from 'claygl/src/Renderer';
import Timeline from 'claygl/src/Timeline';
import Texture2D from 'claygl/src/Texture2D';

var renderer = new Renderer({
    canvas: document.getElementById('main')
});
var timeline = new Timeline();
timeline.start();

var colorList = ['rgb(255, 255, 217)', 'rgb(237, 248, 186)', 'rgb(205, 235, 180)', 'rgb(151, 215, 185)', 'rgb(93, 192, 192)', 'rgb(50, 165, 194)', 'rgb(33, 127, 183)', 'rgb(34, 85, 164)', 'rgb(30, 52, 137)', 'rgb(8, 29, 88)'];

function generateGradientImage() {
    var canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 6;
    var ctx = canvas.getContext('2d');
    var gradient = ctx.createLinearGradient(0, canvas.height / 2, canvas.width, canvas.height / 2);

    for (var i = 0; i < colorList.length; i++) {
        gradient.addColorStop(i / (colorList.length - 1), colorList[i]);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
}

var curlnoise = new CurlNoise();
curlnoise.setSupersampling(2);
curlnoise.setParticleDensity(256);
curlnoise.setParticleSize(2);
curlnoise.setGradientTexture(new Texture2D({
    image: generateGradientImage()
}));
curlnoise.generateSpawnTexture(256);
timeline.on('frame', function (frameTime) {
    frameTime = Math.min(frameTime, 20);
    curlnoise.update(renderer, frameTime);
    curlnoise.output(renderer);
});

function resize() {
    renderer.resize(document.body.clientWidth, document.body.clientHeight);
}

window.addEventListener('resize', resize);
resize();