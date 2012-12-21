var Simulacrum = {
  reproduced: 0,
  died: 0,
  report: []
};

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
    var world = Flora.universe.first();
    Brait.Stimulus.create(null, new Flora.Vector(Flora.Utils.getRandomNumber(0, world.width),
          Flora.Utils.getRandomNumber(0, world.height)), [Simulacrum.Cold]);
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
  vehicle.fertility = Engineer.fertilitySteps;
  return vehicle;
}

Engineer.foodCapacity = 2500;
Engineer.oxygenCapacity = 2500;
Engineer.wasteCapacity = 5000;
Engineer.fertilitySteps = 800;


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
  //console.log("Engineer", this.id, "expelled", wasteExpelled,"/",this.waste, "of heat");
  this.waste -= wasteExpelled;
  new Brait.Stimulus({
    location: behind,
    size: Math.ceil(wasteExpelled/10),
    type: [Simulacrum.Heat]
  });
};


Engineer.metabolize = function() {
  this.resources.oxygen -= 0.8;
  this.resources.food -= 0.8;
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

  for(i = 0, max = Flora.lights.length; i < max; i += 1) {
    if(this.isInside(Flora.lights[i]) && this.waste > Engineer.wasteCapacity / 2) {
      Engineer.produceWaste.call(this);
    }
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

  if(this.fertility >= 0) {
    this.fertility--;
  }

  for(i = 0, max = Simulacrum.engineers.length; i < max; i += 1) {
    if(this !== Simulacrum.engineers[i] && this.isInside(Simulacrum.engineers[i])) {
      Engineer.reproduce.call(this, Simulacrum.engineers[i]);
    }
  }

  Engineer.metabolize.call(this);

  if(this.resources.food < 0 || this.resources.oxygen < 0) {
    console.log('Engineer', this.id, ' has died',
      '(food:', this.resources.food, 'oxygen:', this.resources.oxygen, ')');
    
    Simulacrum.engineers.splice(Simulacrum.engineers.indexOf(this), 1);

    Flora.elementList.destroyElement(this.id);
    Flora.elementList.destroyElement('eye' + this.id);

    for(var i = 0; i < this.sensors.length; i++) {
      Flora.elementList.destroyElement(this.sensors[i].id);
      if(this.sensors[i].connector) {
        Flora.elementList.destroyElement(this.sensors[i].connector.id);
      }
    }
    this.sensors = [];

    Simulacrum.died++;
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
  veh.fertility = Engineer.fertilitySteps;
  return veh;
}

Scientist.produceWaste = function() {
  var behind = Flora.Vector.VectorSub(this.location, new Flora.Vector(-2, -2));
  var wasteExpelled = Flora.Utils.getRandomNumber(1, this.waste);
  //console.log("Scientist", this.id, "expelled", wasteExpelled,"/",this.waste, "of food");
  this.waste -= wasteExpelled;
  new Brait.Stimulus({
    location: behind,
    size: Math.ceil(wasteExpelled/10),
    type: [Brait.Food]
  });
};

Scientist.metabolize = function() {
  this.resources.heat -= 0.8;
  this.resources.cold -= 0.8;
  this.waste += 2;
  if(this.waste >= Engineer.wasteCapacity ||
    Flora.Utils.getRandomNumber(0, this.waste) > Engineer.wasteCapacity / 2) {
    Scientist.produceWaste.call(this);
  }
};

Scientist.reproduce = function(otherScientist) {
  if(this === otherScientist) return;
  if((this.resources.heat > 1000 && this.resources.cold > 1000 && this.fertility < 0) &&
     (otherScientist.resources.heat > 1000 & otherScientist.resources.cold > 1000 && otherScientist.fertility < 0)) {
    this.resources.heat -= 250;
    this.resources.cold -= 250;
    otherScientist.resources.heat -= 250;
    otherScientist.resources.cold -= 250;

    if(Simulacrum.engineers.length <= 1) {
      console.log('life finds a way');
      Engineer.create();
    } else {
      Scientist.create();
    }
    
    this.fertility = Engineer.fertilitySteps;
    otherScientist.fertility = Engineer.fertilitySteps;
    console.log('Scientists', this.id, 'and', otherScientist.id, 'have reproduced');
    Simulacrum.reproduced++;

  }
};

Scientist.create = function() {
  var color = [
      100,
      Flora.Utils.getRandomNumber(1, 255),
      100
    ];

  var sci = new Scientist({
      controlCamera: false,
      color: [50, 50, 255],
      borderColor: [255, 150, 50],
      viewArgs: [Simulacrum.scientists.length],
      sensors: [
      new Brait.Sensor({
        type: 'light',
        behavior: 'ACCELERATE'
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
};

Engineer.reproduce = function(otherEngineer) {
  if(this === otherEngineer) return;
  if((this.resources.food > 1000 && this.resources.oxygen > 1000 && this.fertility < 0) &&
     (otherEngineer.resources.food > 1000 & otherEngineer.resources.oxygen > 1000 && otherEngineer.fertility < 0)) {
    this.resources.food -= 250;
    this.resources.oxygen -= 250;
    otherEngineer.resources.food -= 250;
    otherEngineer.resources.oxygen -= 250;

    if(Simulacrum.scientists.length <= 1) {
      Scientist.create();
    } else {
      Engineer.create();
    }

    this.fertility = Engineer.fertilitySteps;
    otherEngineer.fertility = Engineer.fertilitySteps;

    console.log('Engineers', this.id, 'and', otherEngineer.id, 'have reproduced');
    Simulacrum.reproduced++;
  }
};

Engineer.create = function() {
  var color = [
      Flora.Utils.getRandomNumber(1, 255),
      100,
      100
    ];

  var eng = new Engineer({
    controlCamera: false,
    color: color,
    borderColor: [255, 100, 0],
    viewArgs: [Simulacrum.engineers.length],
    sensors: [
    new Brait.Sensor({
      type: 'light',
      behavior: 'ACCELERATE'
    }), new Brait.Sensor({
      type: 'cold',
      behavior: 'DISLIKES'
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

  for(i = 0, max = Flora.lights.length; i < max; i += 1) {
    if(this.isInside(Flora.lights[i]) && this.waste > Engineer.wasteCapacity / 2) {
      Scientist.produceWaste.call(this);
    }
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

  if(this.fertility >= 0) {
    this.fertility--;
  }

  for(i = 0, max = Simulacrum.scientists.length; i < max; i += 1) {
    if(this !== Simulacrum.scientists[i] && this.isInside(Simulacrum.scientists[i])) {
      Scientist.reproduce.call(this, Simulacrum.scientists[i]);
    }
  }

  Scientist.metabolize.call(this);

  if(this.resources.heat < 0 || this.resources.cold < 0) {
    console.log('Scientist', this.id, ' has died',
      '(heat:', this.resources.heat, 'cold:', this.resources.cold, ')');
    
    Simulacrum.scientists.splice(Simulacrum.scientists.indexOf(this), 1);

    Flora.elementList.destroyElement(this.id);
    Flora.elementList.destroyElement('eye' + this.id);
    
    for(var i = 0; i < this.sensors.length; i++) {
      Flora.elementList.destroyElement(this.sensors[i].id);
      if(this.sensors[i].connector) {
        Flora.elementList.destroyElement(this.sensors[i].connector.id);
      }
    }
    this.sensors = [];

    Simulacrum.died++;

  }

  var eye = document.getElementById('eye' + this.id),
    a = this.eyeRotation;

  if(eye) {
    eye.style.webkitTransform = 'rotate(' + a + 'deg)';
    this.eyeRotation += Flora.Utils.map(this.velocity.mag(), this.minSpeed, this.maxSpeed, 3, 50);
  }
};

var report = function() {
  var data = {},
      prevData = Simulacrum.report[Simulacrum.report.length - 1];

  data.engineers = Simulacrum.engineers.length;
  data.scientists = Simulacrum.scientists.length;
  data.timestamp = Date.now();
  data.deaths = Simulacrum.died;
  data.births = Simulacrum.reproduced;
  Simulacrum.report.push(data);
};

// start the system; pass initial instuctions
Flora.System.start(function() {

  var world = Flora.universe.first();

  Flora.universe.update({
    c: 0.01,
    gravity: new Flora.Vector(),
    width: 1280,
    height: 800,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: [100, 100, 100]
  });

  var stims = 20;
  while(stims--) {
    Brait.Stimulus.create(null,
      new Flora.Vector(
        Flora.Utils.getRandomNumber(0, world.width),
        Flora.Utils.getRandomNumber(0, world.height)),
      [Brait.Light]);

    Brait.Stimulus.create(null,
      new Flora.Vector(
        Flora.Utils.getRandomNumber(0, world.width),
        Flora.Utils.getRandomNumber(0, world.height)),
      [Brait.Oxygen]);
    
    Brait.Stimulus.create(null,
      new Flora.Vector(
        Flora.Utils.getRandomNumber(0, world.width),
        Flora.Utils.getRandomNumber(0, world.height)),
      [Brait.Food]);
    
    Brait.Stimulus.create(null,
      new Flora.Vector(
        Flora.Utils.getRandomNumber(0, world.width),
        Flora.Utils.getRandomNumber(0, world.height)),
      [Simulacrum.Cold]);

    Brait.Stimulus.create(null,
      new Flora.Vector(
        Flora.Utils.getRandomNumber(0, world.width),
        Flora.Utils.getRandomNumber(0, world.height)),
      [Simulacrum.Heat]);

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
        behavior: 'DISLIKES'
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
      controlCamera: false,
      color: [50, 50, 255],
      borderColor: [255, 150, 50],
      viewArgs: [i],
      sensors: [
      new Brait.Sensor({
        type: 'light',
        behavior: 'ACCELERATE'
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

  setInterval(report, 5000);
});