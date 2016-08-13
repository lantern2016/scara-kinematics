const paper = require('paper/dist/paper-full');
const Point = paper.Point;
const Path = paper.Path;
const Circle = paper.Path.Circle;
const Line = paper.Path.Line;
const Group = paper.Group;

const sin = Math.sin;
const cos = Math.cos;
const tan = Math.tan;
const acos = Math.acos;
const atan = Math.atan;
const sqrt = Math.sqrt;
const abs = Math.abs;

function pow2(x) {
  return Math.pow(x, 2);
}

function radians(d) {
  return d * Math.PI / 180;
  //return capRadians(d * (Math.PI/180));
}

function capDegrees(d) {
  while (d < 0) {
    d += 360;
  }
  while (d >= 360) {
    d -= 360;
  }
  return d;
}

function degrees(r) {
  //return r * (180/Math.PI);
  return capDegrees(r * 180 / Math.PI);
}

// https://www.mathsisfun.com/algebra/trig-solving-sss-triangles.html
function sss(a, b, c) {
  return acos((b*b + c*c - a*a) / (2*b*c));
}

class MBot {
  /*
  The fixed points are the ones at the backboard where the motors are
  attached. You can also see them as the start and end (or bottom) points of a
  capital M. The distance between them (along the backboard) is d. Or the
  length of the gap at the bottom of the M.

  l1 is the length of the "active" arms ie. from the backboard/motor to a
  passive joint. Or the vertical lines in a capital M.

  l2 is the length of the "passive" arms ie. from a passive joint to the end
  effector. Or the angled lines in a capital M.

  A constraint is that the passive arms will never form a straight line
  and the angle formed at the end effector on the inside will always be > 180
  degrees. So it never starts to form a ^ shape. This avoids that singularity.

  At the time of writing I don't think that we have to worry too much about the
  angles at the passive joints forming singularities except if it causes things
  to crash into each other.

  alpha is the angle between the backboard and the left active arm
  beta is the angle between the backboard and the right active arm

  If you draw a line between the passive joints, then it forms an
  isosceles triangle with the end effector. The equal angles are both delta and
  the length of this line (the base of the triangle) is c.

  gamma is the angle formed between the before-mentioned line (the base of the
  isosceles triangle) and a line running parallel with the backboard and
  through one of the passive joints (v2, y2).

  If you form a right triangle from this same passive joint (x2, y2) along this
  imaginary parallel line and up to the end effector, then the length of the
  base of it is e and the height is f.

  {x = 0, y = 0} is the spot at the bottom-left of the M
  {x1, y2} is at the left passive joint
  {x2, y2} is at the right passive joint
  {x, y} is the end effector

  Not that it affects the maths, but all lengths are in millimeters.

  To disambiguate angle units, angle variables ending with a D are in degrees
  and R in radians. Sometimes using one makes more sense than the other.
  */
  constructor(d, l1, l2) {
    this._d = d;
    this._l1 = l1;
    this._l2 = l2;

    //this._max = degrees(acos((l1*l1 + d*d - l2*l2)/(2*l1*d)));

    //this.syncForward(108, 180-108);
    //this.syncForward(140, 180-100);
  }

  get d() {
    return this._d;
  }
  get l1() {
    return this._l1;
  }
  get l2() {
    return this._l2;
  }
  get alphaD() {
    return this._alphaD;
  }
  get betaD() {
    return this._betaD;
  }
  get deltaD() {
    return this._deltaD;
  }
  get gammaD() {
    return this._gammaD;
  }
  get endD() {
    return 360 - (180 - 2*this.deltaD);
  }
  get point() {
    return this._point;
  }
  /*
  get minAlphaD() {
    return this._max;
  }
  get maxAlphaD() {
    return 180;
  }
  get minBetaD() {
    return 0;
  }
  get maxBetaD() {
    return 180-this._max;
  }
  */

  syncForward(alphaD, betaD) {
    this._alphaD = alphaD;
    this._betaD = betaD;

    const alphaR = radians(alphaD);
    const betaR = radians(betaD);

    const l1 = this.l1;
    const l2 = this.l2;
    const d = this.d;

    const x1 = l1*cos(alphaR);
    const y1 = l1*sin(alphaR);
    const x2 = d + l1*cos(betaR);
    const y2 = l1*sin(betaR);

    // NOTE: there are actually positive and negative answers here
    const c = sqrt(
      pow2((d + l1*cos(betaR)) - (l1*cos(alphaR))) +
      pow2((l1*sin(betaR)) - (l1*sin(alphaR)))
    );
    //const c = sqrt(pow2(x2-x1) + pow2(y2-y1));


    // NOTE: atan gives -90 to 90
    //const gammaR = atan((y2-y1)/(x2-x1)); // abs?
    const gammaR = atan(abs(y2-y1)/abs(x2-x1));
    //console.log("gamma", degrees(gammaR));

    // NOTE: acos gives 0-180
    const deltaR = acos(c/(2*l2));

    const e = l2*cos(gammaR+deltaR);
    const f = l2*sin(gammaR+deltaR);
    var x, y;
    if (y2 > y1) {
      x = x2 - e;
      y = y2 - f;
    } else {
      x = x1 + e;
      y = y1 - f;
    }

    const point = new Point(x, y);
    if (!this.validatePoint(point) || !this.validateForward(alphaD, betaD, point)) {
      throw new Error('Invalid result for syncForward.');
    }
    this._point = point;
    this._gammaD = degrees(gammaR);
    this._deltaD = degrees(deltaR);
  }

  validatePoint(point) {
    // TODO: just switch to "point in ellipse" rather
    // http://math.stackexchange.com/questions/76457/check-if-a-point-is-within-an-ellipse

    if (isNaN(point.x) || isNaN(point.y)) {
      //console.log('NaN');
      return false;
    }

    if (point.x < 0 || point.x > this.d) {
      //console.log('point.x < 0 || point.x > this.d');
      return false;
    }

    /*
    if (point.y < 0) {
      //console.log('point.y < 0');
      return false;
    }
    */

    return true;
  }

  validateForward(alphaD, betaD, point) {
    const B = new Point(this.l1, 0).rotate(alphaD);
    const E = new Point(this.d, 0);
    const D = new Point(this.l1, 0).rotate(betaD).add(E);
    const BC = point.subtract(B);
    const DC = point.subtract(D);

    // keep the end effector below the passive joints
    if (point.y >= B.y || point.y >= D.y) {
      //console.log('point.y >= B.y || point.y >= D.y');
      return false;
    }

    /*
    if (point.x < B.x || point.x > D.x) {
      console.log('point.x < B.x || point.x > D.x');
      return false;
    }
    */

    if (B.x > D.x) {
      //console.log('B.x > D.x');
      return false;
    }

    //console.log(BC.length, DC.length);

    // make sure that the limbs aren't longer than they can be
    if (abs(BC.length-this.l2) > 1) {
      //console.log('BC length', BC.length);
      return false;
    }
    if (abs(DC.length-this.l2) > 1) {
      //console.log('DC length', DC.length);
      return false;
    }

    return true;
  }

  syncReverse(point) {
    if (!this.validatePoint(point)) {
      throw new Error('Invalid result for syncReverse.');
    }

    // NOTE: gamma and delta here aren't the same angles as in syncForward

    /*
    alpha, beta, l1, l2, d, x and y have the same meanings as for syncForward
    c is the length of the line from {0, 0} to {x, y}
    e is the length of the line from {d, 0} to {x, y}
    gamma is the angle formed between the lines c and l1 at {d, 0}
    epsilon is the angle formed between the lines e and l1 at {d, 0}
    delta is the angle formed between the lines c and d at {0, 0}
    psi is the angle formed between the lines e and d at {d, 0}
    */

    const l1 = this.l1;
    const l2 = this.l2;
    const d = this.d;
    const x = point.x;
    const y = point.y;

    const c = sqrt(x*x + y*y);
    const e = sqrt(pow2(d-x) + y*y);
    // NOTE: atan only defined for -90 to 90
    const deltaR = atan(y/x);
    // NOTE: acos only defined for 0 to 180
    const gammaR = sss(l2, c, l1);
    const epsilonR = sss(l2, e, l1);
    const psiR = atan(y/(d-x));

    const alphaD = degrees(deltaR+gammaR);
    const betaD = 180 - degrees(epsilonR) - degrees(psiR);
    this.syncForward(alphaD, betaD);

    // TODO: check that this._point is not too different to point

  }

  getOffset() {
    const size = paper.view.size;
    return new Point(size.width/2-this.d/2, size.height/2);
    //return new Point(size.width/2-this.d/2, size.height/2-this.l1/2);
    //return new Point(size.width/2-this.d/2, 100);
  }

  draw() {
    if (this.group) {
      this.group.remove();
      this.group = null;
    }

    const offset = this.getOffset();

    const A = new Point(0, 0).add(offset);
    const B = new Point(this.l1, 0).rotate(this.alphaD).add(offset);
    const E = new Point(this.d, 0).add(offset);
    const D = new Point(this.l1, 0).rotate(this.betaD).add(E);

    const C = this.point.add(offset);

    var paths = [];

    var backboard = new Line(A, E);
    backboard.dashArray = [10, 4];
    paths.push(backboard);

    paths.push(new Line(A, B));
    paths.push(new Line(D, E));

    paths.push(new Line(B, C));
    paths.push(new Line(D, C));
    paths.push(new Circle(C, 20));

    paths.push(new Circle(A, 40));
    paths.push(new Circle(E, 40));

    // see https://en.wikipedia.org/wiki/Isosceles_trapezoid
    const p = sqrt(this.d * this.l2*2 + this.l1*this.l1);
    const theta = degrees(sss(p, this.d, this.l1));
    const height = new Point(this.l1, 0).rotate(theta).y;
    const rectangle = new paper.Rectangle(offset.subtract(new Point(0, height)), new paper.Size(this.d, height*2));
    paths.push(new paper.Path.Ellipse(rectangle));

    var group = new Group(paths);
    //const b = group.bounds;
    //const center = new Point(b.width/2+b.x, b.height/2+b.y);
    //console.log(group.bounds, group.position, group.bounds.center);
    //group.matrix.scale(1, -1, center);
    //console.log(group.bounds, group.position);
    //group.matrix.rotate(180, center);

    group.strokeColor = 'black';
    group.strokeWidth = 2;

    //paper.project.activeLayer.matrix.scale(1, -1);

    //group.position = offset;

    this.group = group;
  }

  drawReachable() {
    var raster = new paper.Raster();
    raster.size = paper.view.size;
    raster.position = paper.view.center;

    const offset = this.getOffset();
    const color = new paper.Color(0.5, 0.5, 0.5);

    const scale = 2;
    const step = 1;
    for (var a=0; a<360*scale; a+=step) {
      for (var b=0; b<360*scale; b+=step) {
        try {
          this.syncForward(a/scale, b/scale);
        } catch(e) {
          continue;
        }
        //let circle = new Circle(this.point.add(offset), 1)
        //circle.strokeColor = new paper.Color(0, 0, 0, 0.2);
        raster.setPixel(this.point.add(offset), color)
      }
    }
  }
}



var bot;
window.addEventListener('load', function() {
  //paper.install(window);
  paper.setup('paperCanvas');
  paper.view.onFrame = function() {
    //console.log('onFrame');
  };
  const scale = 300;
  bot = new MBot(2*scale, 1*scale, 1*scale);
  bot.drawReachable();
  //bot.syncForward(108, 180-108);
  //bot.syncForward(45, 180-45);
  bot.syncReverse(new Point(bot.d/2, 0));
  bot.draw();

  function syncToPoint(point) {
    //console.log(point);
    //var circle = new Circle(point.add(offset), 5);
    //circle.strokeColor = new paper.Color(0, 0, 0);

    try {
      bot.syncReverse(point);
      bot.draw();
    } catch(e) {
      console.error(e);
    }
  }

  var tool = new paper.Tool();
  tool.onMouseDown = function(event) {
    const offset = bot.getOffset();
    const point = event.point.subtract(offset);
    console.log(point);
    syncToPoint(point);
    console.log(bot.alphaD, bot.betaD);
  };
  tool.onMouseDrag = function(event) {
    const offset = bot.getOffset();
    const point = event.point.subtract(offset);
    syncToPoint(point);
  };
  tool.onMouseUp = function(event) {
    const offset = bot.getOffset();
    const point = event.point.subtract(offset);
    syncToPoint(point);
  };
});

window.addEventListener('resize', function() {
  setTimeout(function() {
    bot.draw();
  }, 0);
});

