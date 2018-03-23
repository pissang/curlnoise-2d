import Geometry from 'claygl/src/Geometry';

var LinesGeometry = Geometry.extend(function () {
    return {

        dynamic: true,

        attributes: {
            position: new Geometry.Attribute('position', 'float', 3, 'POSITION')
        }
    };
},
{

    /**
     * Reset offset
     */
    resetOffset: function () {
        this._vertexOffset = 0;
        this._faceOffset = 0;
    },

    /**
     * @param {number} nVertex
     */
    setLineCount: function (nLine) {
        var attributes = this.attributes;
        var nVertex = 4 * nLine;
        var nTriangle = 2 * nLine;
        if (this.vertexCount !== nVertex) {
            attributes.position.init(nVertex);
        }
        if (this.triangleCount !== nTriangle) {
            if (nTriangle === 0) {
                this.indices = null;
            }
            else {
                this.indices = this.vertexCount > 0xffff ? new Uint32Array(nTriangle * 3) : new Uint16Array(nTriangle * 3);
            }
        }
    },

    addLine: function (p) {
        var vertexOffset = this._vertexOffset;
        var attributes = this.attributes;
        attributes.position.set(vertexOffset, [p[0], p[1], 1]);
        attributes.position.set(vertexOffset + 1, [p[0], p[1], -1]);
        attributes.position.set(vertexOffset + 2, [p[0], p[1], 2]);
        attributes.position.set(vertexOffset + 3, [p[0], p[1], -2]);

        this.setTriangleIndices(
            this._faceOffset++, [
                vertexOffset, vertexOffset + 1, vertexOffset + 2
            ]
        );
        this.setTriangleIndices(
            this._faceOffset++, [
                vertexOffset + 1, vertexOffset + 2, vertexOffset + 3
            ]
        );

        this._vertexOffset += 4;
    }
});

export default LinesGeometry;