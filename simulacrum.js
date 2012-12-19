var Simulacrum = {};

Simulacrum.Heat = function(options) {
  var heat = new Brait.Heat(options);
  var oldBeforeStep = heat.beforeStep;
  heat.beforeStep = Simulacrum.Heat.beforeStep;
  return heat;
};

Simulacrum.Heat.beforeStep = function() {
  var delta = Math.abs(this.scaleTarget - this.scale);
  if (delta > 0.001 && this.scale < this.scaleTarget) {
    this.scale += delta / 10;
  } else if (delta > 0.001 && this.scale > this.scaleTarget) {
    this.scale -= delta / 10;
  } else {
    this.scaleTarget = this.scale - 0.01;
  }

  if(this.scale < 0.1) {
    Flora.elementList.destroyElement(this.id);
    Flora.heats.splice(Flora.heats.indexOf(this), 1);
  }
};

Simulacrum.Cold = function(options) {
  var cold = new Brait.Cold(options);
  var oldBeforeStep = cold.beforeStep;
  cold.beforeStep = Simulacrum.Cold.beforeStep;
  return cold;
};

Simulacrum.Cold.beforeStep = function() {
  var delta = Math.abs(this.scaleTarget - this.scale);
  if (delta > 0.001 && this.scale < this.scaleTarget) {
    this.scale += delta / 10;
  } else if (delta > 0.001 && this.scale > this.scaleTarget) {
    this.scale -= delta / 10;
  } else {
    this.scaleTarget = this.scale;
  }

  if(this.scale < 0.1) {
    Flora.elementList.destroyElement(this.id);
    Flora.colds.splice(Flora.colds.indexOf(this), 1);
  }
};

function Engineer(options) {
  options.beforeStep = options.beforeStep || Engineer.beforeStep;
  var resources = {
    food: 1000,
    oxygen: 1000,
    light: 10,
    heat: 10
  };
  var vehicle = new Brait.Vehicle(options);
  vehicle.resources = resources;
  vehicle.waste = 0;
  return vehicle;
}

Engineer.foodCapacity = 2500;
Engineer.oxygenCapacity = 2500;
Engineer.wasteCapacity = 5000;


Engineer.build = function() {
  var oxyMin = 10;
  var foodMin = 10;
  var currentFood = this.resources.food;
  var currentOxygen = this.resources.oxygen;

  var enough = currentFood > foodMin * 4 && currentOxygen > oxyMin * 4;
  if(this.knowledge.light > 100 && enough) {
    var oxyCost = Flora.Utils.getRandomNumber(oxyMin, oxyMin * 4);
    var foodCost = Flora.Utils.getRandomNumber(foodMin, foodMin * 4);
    var behind = Flora.Vector.VectorSub(this.location, new Flora.Vector(-2, -2));
    new Brait.Stimulus({
      location: behind,
      size: oxyCost + foodCost,
      type: [Simulacrum.Heat]
    });
    this.resources.food = currentFood - foodCost;
    this.resources.oxygen = currentOxygen - oxyCost;
    console.log(this.id, ' used ', foodCost, '/', currentFood, ' food and ',
      oxyCost, '/', currentOxygen, ' oxygen');
  }
};


Engineer.produceWaste = function() {
  var behind = Flora.Vector.VectorSub(this.location, new Flora.Vector(-2, -2));
  var wasteExpelled = Flora.Utils.getRandomNumber(1, this.waste);
  new Brait.Stimulus({
    location: behind,
    size: Math.ceil(wasteExpelled/10),
    type: [Simulacrum.Heat]
  });
  this.waste -= wasteExpelled;
};

Engineer.metabolize = function() {
  this.resources.oxygen--;
  this.resources.food--;
  this.waste += 2;
  if(this.waste >= Engineer.wasteCapacity ||
    Flora.Utils.getRandomNumber(0, this.waste) > Engineer.wasteCapacity / 2) {
    Engineer.produceWaste.call(this);
  }
};

Engineer.beforeStep = function() {

  var i, max;

  if(Flora.Utils.getRandomNumber(0, 200) === 1) {
    this.randomRadius = 100;
    this.seekTarget = { // find a random point and steer toward it
      location: Flora.Vector.VectorAdd(this.location, new Flora.Vector(Flora.Utils.getRandomNumber(-this.randomRadius, this.randomRadius), Flora.Utils.getRandomNumber(-this.randomRadius, this.randomRadius)))
    };
    var me = this;
    setTimeout(function() {
      me.seekTarget = null;
    }, 100);
  }

  for(i = 0, max = Flora.oxygen.length; i < max; i += 1) {
    if(this.isInside(Flora.oxygen[i])) {
      this.resources.oxygen += 10;
      this.collisions.oxygen.call(this, i);
    }
  }

  for(i = 0, max = Flora.food.length; i < max; i += 1) {
    if(this.isInside(Flora.food[i])) {
      this.resources.food += 10;
      this.collisions.food.call(this, i);
    }
  }

  Engineer.metabolize.call(this);

  if(this.resources.food < 0 || this.resources.oxygen < 0) {
    console.log('Engineer:', this.id, ' has died');
    
    Simulacrum.engineers.splice(Simulacrum.engineers.indexOf(this), 1);

    Flora.elementList.destroyElement(this.id);
    Flora.elementList.destroyElement('eye' + this.id);
  }

  var eye = document.getElementById('eye' + this.id),
    a = this.eyeRotation;

  if(eye) {
    eye.style.webkitTransform = 'rotate(' + a + 'deg)';
    this.eyeRotation += Flora.Utils.map(this.velocity.mag(), this.minSpeed, this.maxSpeed, 3, 50);
  }
};

function Scientist(options) {
  options.beforeStep = options.beforeStep || Scientist.beforeStep;
  var resources = {
    heat: 1000,
    cold: 1000,
    light: 100
  };
  var veh = new Brait.Vehicle(options);
  veh.resources = resources;
  veh.waste = 0;
  return veh;
}

Scientist.produceWaste = function() {
  var behind = Flora.Vector.VectorSub(this.location, new Flora.Vector(-2, -2));
  var wasteExpelled = Flora.Utils.getRandomNumber(1, this.waste);
  console.log("Scientist", this.id, "expelled", wasteExpelled,"/",this.waste, "of food");
  this.waste -= wasteExpelled;
  new Brait.Stimulus({
    location: behind,
    size: Math.ceil(wasteExpelled/10),
    type: [Brait.Food]
  });
};

Scientist.metabolize = function() {
  this.resources.heat--;
  this.resources.cold--;
  this.waste += 2;
  if(this.waste >= Engineer.wasteCapacity ||
    Flora.Utils.getRandomNumber(0, this.waste) > Engineer.wasteCapacity / 2) {
    Scientist.produceWaste.call(this);
  }
};

Scientist.beforeStep = function() {
  if(Flora.Utils.getRandomNumber(0, 200) === 1) {
    this.randomRadius = 100;
    this.seekTarget = { // find a random point and steer toward it
      location: Flora.Vector.VectorAdd(this.location, new Flora.Vector(Flora.Utils.getRandomNumber(-this.randomRadius, this.randomRadius), Flora.Utils.getRandomNumber(-this.randomRadius, this.randomRadius)))
    };
    var me = this;
    setTimeout(function() {
      me.seekTarget = null;
    }, 100);
  }

  for(i = 0, max = Flora.heats.length; i < max; i += 1) {
    if(this.isInside(Flora.heats[i])) {
      this.resources.heat += 10;
      Flora.heats[i].scaleTarget -= 0.015;
    }
  }

  for(i = 0, max = Flora.colds.length; i < max; i += 1) {
    if(this.isInside(Flora.colds[i])) {
      this.resources.cold += 10;
      Flora.colds[i].scaleTarget -= 0.015;
    }
  }

  Scientist.metabolize.call(this);

  if(this.resources.heat < 0 || this.resources.cold < 0) {
    console.log('Scientist:', this.id, ' has died');
    
    Simulacrum.scientists.splice(Simulacrum.scientists.indexOf(this), 1);

    Flora.elementList.destroyElement(this.id);
    Flora.elementList.destroyElement('eye' + this.id);
  }

  var eye = document.getElementById('eye' + this.id),
    a = this.eyeRotation;

  if(eye) {
    eye.style.webkitTransform = 'rotate(' + a + 'deg)';
    this.eyeRotation += Flora.Utils.map(this.velocity.mag(), this.minSpeed, this.maxSpeed, 3, 50);
  }
};

// start the system; pass initial instuctions
Flora.System.start(function() {

  var world = Flora.universe.first();

  Flora.universe.update({
    c: 0.01,
    gravity: new Flora.Vector(),
    width: 3000,
    height: 1500,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: [100, 100, 100]
  });

  var stims = 100;
  while(stims--) {
    Brait.Stimulus.create(null,
      new Flora.Vector(
        Flora.Utils.getRandomNumber(0, world.width),
        Flora.Utils.getRandomNumber(0, world.height)),
      [Brait.Light, Brait.Oxygen, Brait.Food, Simulacrum.Cold, Simulacrum.Heat]);
  }

  Simulacrum.engineers = [];
  Simulacrum.scientists = [];
  for(var i = 0; i < 5; i++) {

    var eng = new Engineer({
      controlCamera: false,
      color: !i ? [255, 255, 255] : [255, 100, 0],
      borderColor: !i ? [255, 100, 0] : [255, 150, 50],
      viewArgs: [i],
      sensors: [
      new Brait.Sensor({
        type: 'light',
        behavior: 'ACCELERATE'
      }), new Brait.Sensor({
        type: 'cold',
        behavior: 'EXPLORER'
      }), new Brait.Sensor({
        type: 'heat',
        behavior: 'EXPLORER'
      }), new Brait.Sensor({
        type: 'oxygen',
        behavior: 'LIKES'
      }), new Brait.Sensor({
        type: 'food',
        behavior: 'LIKES'
      })],
      collisions: {
        'light': Brait.Light.collide,
        'food': Brait.Food.collide,
        'oxygen': Brait.Oxygen.collide
      }
    });

    Simulacrum.engineers.push(eng);

    var sci = new Scientist({
      controlCamera: !i,
      color: [50, 50, 255],
      borderColor: [255, 150, 50],
      viewArgs: [i],
      sensors: [
      new Brait.Sensor({
        type: 'light',
        behavior: 'EXPLORER'
      }), new Brait.Sensor({
        type: 'cold',
        behavior: 'LIKES'
      }), new Brait.Sensor({
        type: 'heat',
        behavior: 'LIKES'
      })],
      collisions: {
        'light': Brait.Light.collide,
        'food': Brait.Food.collide,
        'oxygen': Brait.Oxygen.collide
      }
    });

    Simulacrum.scientists.push(sci);
  }

  Flora.Utils.addEvent(document, 'mouseup', function() {
    Brait.Stimulus.create(null,
      new Flora.Vector(
        Flora.Utils.getRandomNumber(0, world.width),
        Flora.Utils.getRandomNumber(0, world.height)),
      [Brait.Heat, Brait.Light, Brait.Oxygen, Brait.Food]);
  });
});