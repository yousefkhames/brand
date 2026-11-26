/* Original flat garment illustrations drawn in SVG so the demo needs no photos. */
(function (root) {
  'use strict';
  function shade(hex, amt) {
    var h = hex.replace('#', ''), out = '#';
    for (var i = 0; i < 3; i++) {
      var v = parseInt(h.substr(i * 2, 2), 16);
      v = Math.max(0, Math.min(255, Math.round(v + amt * (amt < 0 ? v : 255 - v))));
      out += (v < 16 ? '0' : '') + v.toString(16);
    }
    return out;
  }
  var SHAPES = {
    tee: function (c, d) {
      return '<path d="M70 52 L100 38 Q120 54 140 38 L170 52 L196 92 L170 108 L160 96 L160 188 L80 188 L80 96 L70 108 L44 92 Z" fill="' + c + '"/>' +
        '<path d="M100 38 Q120 54 140 38 L140 44 Q120 62 100 44 Z" fill="' + d + '"/>' +
        '<path d="M80 96 L80 188 M160 96 L160 188" stroke="' + d + '" stroke-width="1.5" opacity=".5"/>';
    },
    shirt: function (c, d) {
      return '<path d="M70 52 L98 38 L120 66 L142 38 L170 52 L196 90 L170 106 L160 96 L160 190 L80 190 L80 96 L70 106 L44 90 Z" fill="' + c + '"/>' +
        '<path d="M98 38 L120 66 L142 38 L132 36 L120 50 L108 36 Z" fill="' + d + '"/>' +
        '<path d="M120 66 L120 190" stroke="' + d + '" stroke-width="2"/>' +
        '<circle cx="120" cy="92" r="2.4" fill="' + d + '"/><circle cx="120" cy="124" r="2.4" fill="' + d + '"/><circle cx="120" cy="156" r="2.4" fill="' + d + '"/>';
    },
    hoodie: function (c, d) {
      return '<path d="M74 54 L98 40 Q120 28 142 40 L166 54 L200 120 L176 132 L162 108 L162 196 L78 196 L78 108 L64 132 L40 120 Z" fill="' + c + '"/>' +
        '<path d="M98 40 Q120 24 142 40 Q140 74 120 80 Q100 74 98 40Z" fill="' + d + '"/>' +
        '<path d="M110 80 L108 112 M130 80 L132 112" stroke="' + shade(c, .5) + '" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M96 160 Q120 150 144 160 L146 186 L94 186 Z" fill="' + d + '" opacity=".55"/>';
    },
    pants: function (c, d) {
      return '<path d="M78 34 L162 34 L172 200 L126 200 L120 96 L114 200 L68 200 Z" fill="' + c + '"/>' +
        '<path d="M78 34 L162 34 L162 48 L78 48 Z" fill="' + d + '"/>' +
        '<path d="M120 48 L120 96" stroke="' + d + '" stroke-width="2"/>';
    },
    dress: function (c, d) {
      return '<path d="M92 34 L106 34 Q120 52 134 34 L148 34 L152 92 L190 204 L50 204 L88 92 Z" fill="' + c + '"/>' +
        '<path d="M88 92 L152 92 L152 100 L88 100 Z" fill="' + d + '"/>' +
        '<path d="M120 52 L120 204" stroke="' + d + '" stroke-width="1.8"/>' +
        '<circle cx="120" cy="72" r="2.2" fill="' + d + '"/><circle cx="120" cy="124" r="2.2" fill="' + d + '"/><circle cx="120" cy="160" r="2.2" fill="' + d + '"/>';
    },
    cap: function (c, d) {
      return '<path d="M52 128 Q54 64 120 62 Q186 64 188 128 Z" fill="' + c + '"/>' +
        '<path d="M52 128 Q110 120 176 128 Q214 132 220 146 Q150 134 52 138 Z" fill="' + d + '"/>' +
        '<path d="M120 62 L120 126 M86 70 Q80 100 84 126 M154 70 Q160 100 156 126" stroke="' + d + '" stroke-width="1.6" fill="none" opacity=".7"/>' +
        '<circle cx="120" cy="60" r="4" fill="' + d + '"/>';
    }
  };
  function garment(type, color, w) {
    var c = color || '#d9c6a5', d = shade(c, -.22);
    var fn = SHAPES[type] || SHAPES.tee;
    return '<svg viewBox="0 0 240 240" role="img" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<ellipse cx="120" cy="214" rx="64" ry="6" fill="#000" opacity=".12"/>' + fn(c, d) + '</svg>';
  }
  /* The logo: a monogram inside a sun-ring built from brand colours. */
  function logo(letter, c1, c2) {
    var l = String(letter || 'B').slice(0, 2).replace(/[<>&"']/g, '');
    var rays = '';
    for (var i = 0; i < 12; i++) rays += '<rect x="48.5" y="3" width="3" height="9" rx="1.5" transform="rotate(' + i * 30 + ' 50 50)" fill="' + c2 + '"/>';
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + rays +
      '<circle cx="50" cy="50" r="32" fill="' + c1 + '"/>' +
      '<text x="50" y="62" text-anchor="middle" font-family="Georgia,serif" font-size="' + (l.length > 1 ? 30 : 38) + '" font-weight="700" fill="#fff">' + l + '</text></svg>';
  }
  root.BrandArt = { garment: garment, logo: logo, shade: shade };
})(typeof self !== 'undefined' ? self : this);
