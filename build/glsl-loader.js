module.exports = function (glslCode) {
    glslCode = glslCode
        .replace(/\r/g, '' ) // remove \r
        .replace(/[ \t]*\/\/.*\n/g, '' ) // remove //
        .replace(/[ \t]*\/\*[\s\S]*?\*\//g, '' ) // remove /* */
        .replace(/\n{2,}/g, '\n' ) // # \n+ to \n
        .replace(/ +/g, ' ');   // Remove spaces.
    return 'module.exports = ' + JSON.stringify(glslCode);
};