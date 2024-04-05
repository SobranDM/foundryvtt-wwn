#!/bin/node

const ITERATIONS = 1000;
const DELTA = 0.05;
const ITERATIONS_MIN = 20;
const LEVELS = 10;

const classes = 
    [{
        name: "Warrior",
        hitDice: {
            random: 6,
            bonus: 2
        }

    },{
        name: "Expert",
        hitDice: {
            random: 6,
            bonus: 0
        }
    },{
        name: "Mage",
        hitDice: {
            random: 6,
            bonus: -1
        }

    }];

const armor =
    [{
        name: "none",
        acOld: 10,
        acNewPenalty: 0,
        soak: 0
    },{
        name: "light-1",
        acOld: 12,
        acNewPenalty: 0,
        soak: 1
    },{
        name: "light-2",
        acOld: 14,
        acNewPenalty: -2,
        soak: 2
    },{
        name: "medium-1",
        acOld: 14,
        acNewPenalty: -1,
        soak: 2
    },{
        name: "medium-2",
        acOld: 16,
        acNewPenalty: -3,
        soak: 3
    },{
        name: "heavy-1",
        acOld: 16,
        acNewPenalty: -2,
        soak: 3
    },{
        name: "heavy-2",
        acOld: 18,
        acNewPenalty: -4,
        soak: 4
    }];

const enemies = 
    [{
        name: "Razorhorn",
        hitDice: 4,
        attack: 1,
        damageRoll: 8,
        damageRollNumber: 1,
        oldDamageBonus: 0,
        newDamageBonus: 2,
        shock: 1,
        shockAC: 95
    }];

const calculateHp = (level, htDice, con) => {
    let hp = 0;
    for(let l = 0; l<level; l++) {
        hp += Math.random() * htDice.random;
        hp = Math.ceil(hp) +  htDice.bonus + con;
    }
    return Math.max(1,hp);
}

const printLevel = (level) => {
    logItalic (`LEVEL #${level}`);
}

const shouldProceed = (iterations, variants, currentHp, currentEnemyHitOld, currentEnemyHitNew) => {
    if(iterations < ITERATIONS_MIN) return true;
    let should = true;
    if(currentHp/(variants+1) < DELTA) should = should && false;
    currentEnemyHitOld.forEach(enemyHit => {
        if(enemyHit/(variants+1) < DELTA) should = should && false;
    });
    currentEnemyHitNew.forEach(enemyHit => {
        if(enemyHit/(variants+1) < DELTA) should = should && false;
    });
    return should;
}

const calculateEnemyHitsOld = (currentHp, ac, enemy, rolls) => {
    let hp = currentHp;
    let hits = 0;
    let i = 0;
    while(hp>0) {
        if(rolls.length < i+1){
            rolls.push(Math.ceil(Math.random()*20));
        }
        if(rolls[i] < ac - enemy.attack) {
            if(ac<=enemy.shockAC){
                hp -= enemy.shock;
            }
        } else {
            for(let j = 0; j<enemy.damageRollNumber; j++){
              hp -= Math.ceil(enemy.damageRoll * Math.random());
            }
            hp -= enemy.oldDamageBonus;
        }
        hits +=1;
        i++;
    }
    return hits;
}

const calculateEnemyHitsNew = (currentHp, ac, soak, enemy, rolls) => {
    let hp = currentHp;
    let hits = 0;
    let i = 0;
    while(hp>0) {
        if(rolls.length < i+1){
            rolls.push(Math.ceil(Math.random()*20));
        }
        let damage = 0;
        if(rolls[i] < ac - enemy.attack) {
        } else {
            for(let j = 0; j<enemy.damageRollNumber; j++){
                damage += Math.ceil(enemy.damageRoll * Math.random());
            }
            damage += enemy.newDamageBonus;
            hp -= Math.max(damage - soak, 1);
        }
        hits +=1;
        i++;
    }
    return hits;
}

classes.forEach((clazz) => {
    console.log(`${clazz.name.toUpperCase()}:`);
    for(let l = 1; l <= LEVELS; l++) {
        printLevel(l);
        let variants = 0;
        let hp = 0;
        let enemyHitsOld = new Array(enemies.length).fill(0);
        let enemyHitsNew = new Array(enemies.length).fill(0);
        armor.forEach((armor) => {
            for(let str = -2; str <= 2; str ++) {
                for (let dex = -2; dex <= 2; dex ++) {
                    for(let con = -2; con <= 2; con++) {
                        for(let it = 0; it < ITERATIONS; it++) {
                            const rolls = [];
                            const acOld = armor.acOld + dex;
                            const acNew = 10 + dex + str + armor.acNewPenalty + 0 ;
                            const currentHp = calculateHp(l, clazz.hitDice, con);
                            const hitsOld = enemies.map((enemy) => calculateEnemyHitsOld(currentHp, acOld, enemy, rolls));
                            const hitsNew = enemies.map((enemy) => calculateEnemyHitsNew(currentHp, acNew, armor.soak, enemy, rolls));
                            const should = shouldProceed(it, variants, currentHp, hitsOld, hitsNew);
                            if(!should) {
                                break;
                            }
                            hp += currentHp; 
                            hitsOld.forEach((newHit, i) => enemyHitsOld[i]+=newHit);
                            hitsNew.forEach((newHit, i) => enemyHitsNew[i]+=newHit);
                            variants += 1;
                        }
                    }
                }
            }
            console.log(`    armor: ${armor.name}`);
            enemies.forEach((enemy,i) => 
                console.log(`      ${Math.round(enemyHitsOld[i]/variants)} | ${Math.round(enemyHitsNew[i]/variants)} hits from 1d(${enemy.hitDice}) ${enemy.name} +${enemy.attack} (${enemy.damageRollNumber}d${enemy.damageRoll} + ${enemy.oldDamageBonus}|${enemy.newDamageBonus})`));
        });
    }
});
function logBold(...arguments) {
  if (typeof(console) !== 'undefined') {
//    arguments.unshift("\x1b[1m");
    arguments.unshift("\x1b[31m");
    arguments.push("\x1b[0m");
    console.log.apply(console, arguments);
  }
}

function logItalic(...arguments) {
  if (typeof(console) !== 'undefined') {
    arguments.unshift("\x1b[3m");
    arguments.unshift("\x1b[34m");
    arguments.push("\x1b[0m");
    console.log.apply(console, arguments);
  }
}

function logError(...arguments) {
  if (typeof(console) !== 'undefined') {
    arguments.unshift("\x1b[31m");
    arguments.push("\x1b[0m");
    console.log.apply(console, arguments);
  }
}

function logSuccess(...arguments) {
  if (typeof(console) !== 'undefined') {
    arguments.unshift("\x1b[32m");
    arguments.push("\x1b[0m");
    console.log.apply(console, arguments);
  }
}

// Warrior 
//   level
//   mean hp (-2,-1,0,1,2)
//   dex (-2,-1,0,1,2)
//   str (-2,-1,0,1,2)
//   armor (non, light, medium, heavy)
//   shield (none, light, heavy)
//   armor skill (-1,0,1,2,3,4)
