const Web3 = require('web3')
const rpcURL = "https://bsc-dataseed1.binance.org/"
const web3 = new Web3(rpcURL)
const Tx = require('ethereumjs-tx')

const {gameContract, characterContract, weaponContract} = require('./contract')

const EXPERIENCE_TABLE = [
    16, 17, 18, 19, 20, 22, 24, 26, 28, 30,
    33, 36, 39, 42, 46, 50, 55, 60, 66, 72,
    79, 86, 94, 103, 113, 124, 136, 149, 163, 178, 
    194, 211, 229, 248, 268, 289, 311, 334, 358, 383, 
    409, 436, 464, 493, 523, 554, 586, 619, 653, 688, 
    724, 761, 799, 838, 878, 919, 961, 1004, 1048, 1093, 
    1139, 1186, 1234, 1283, 1333, 1384, 1436, 1489, 1543, 1598, 
    1654, 1711, 1769, 1828, 1888, 1949, 2011, 2074, 2138, 2203, 
    2269, 2336, 2404, 2473, 2543, 2614, 2686, 2759, 2833, 2908, 
    2984, 3061, 3139, 3218, 3298, 3379, 3461, 3544, 3628, 3713, 
    3799, 3886, 3974, 4063, 4153, 4244, 4336, 4429, 4523, 4618, 
    4714, 4811, 4909, 5008, 5108, 5209, 5311, 5414, 5518, 5623, 
    5729, 5836, 5944, 6053, 6163, 6274, 6386, 6499, 6613, 6728, 
    6844, 6961, 7079, 7198, 7318, 7439, 7561, 7684, 7808, 7933, 
    8059, 8186, 8314, 8443, 8573, 8704, 8836, 8969, 9103, 9238, 
    9374, 9511, 9649, 9788, 9928, 10069, 10211, 10354, 10498, 10643, 
    10789, 10936, 11084, 11233, 11383, 11534, 11686, 11839, 11993, 12148, 
    12304, 12461, 12619, 12778, 12938, 13099, 13261, 13424, 13588, 13753, 
    13919, 14086, 14254, 14423, 14593, 14764, 14936, 15109, 15283, 15458, 
    15634, 15811, 15989, 16168, 16348, 16529, 16711, 16894, 17078, 17263, 
    17449, 17636, 17824, 18013, 18203, 18394, 18586, 18779, 18973, 19168, 
    19364, 19561, 19759, 19958, 20158, 20359, 20561, 20764, 20968, 21173, 
    21379, 21586, 21794, 22003, 22213, 22424, 22636, 22849, 23063, 23278, 
    23494, 23711, 23929, 24148, 24368, 24589, 24811, 25034, 25258, 25483, 
    25709, 25936, 26164, 26393, 26623, 26854, 27086, 27319, 27553, 27788, 
    28024, 28261, 28499, 28738, 28978
];

const gameAddress = '0x39Bea96e13453Ed52A734B6ACEeD4c41F57B2271'

function calculateWinChances(heroPower, enemyPower){
    let wins = 0
    let losses = 0
    let heroMinPower = heroPower * 0.9
    let heroMaxPower = heroPower * 1.1
    let enemyMinPower = enemyPower * 0.9
    let enemyMaxPower = enemyPower * 1.1
    for(let heroTempPower = heroMinPower; heroTempPower <= heroMaxPower; heroTempPower++){
        if(heroTempPower - enemyMinPower > 0){
            wins += heroTempPower - enemyMinPower
        }
        if(enemyMaxPower - heroTempPower > 0){
            losses += enemyMaxPower - heroTempPower
        }
    }
    return(wins / (losses + wins) * 100)
}

async function selectEnemy(character, weapon){
    let characterTrait = await characterContract.methods.getTrait(character).call()
    let weaponTrait = await weaponContract.methods.getTrait(weapon).call()

    //----------Poder del héroe----------//
    let basePowerLevel = await characterContract.methods.getPower(character).call()
    let fightData = await weaponContract.methods.getFightData(weapon, characterTrait).call()
    let weaponMultFight = fightData[1]
    let weaponBonusPower = fightData[2]
    let playerPower = await gameContract.methods.getPlayerPower(
        basePowerLevel, weaponMultFight, weaponBonusPower
    ).call()
    let targets = await gameContract.methods.getTargets(character, weapon).call()
    let targetSelected = -1
    let diffPowerFinal = 0
    let finalPlayerPower
    let enemyPower

    //----------Selección de enemigo----------//
    for(let x = 0; x < targets.length; x++){
        let target = targets[x]
        let enemyTrait = parseInt(target, 10) >> 24
        let traitBonus = 0
        traitBonus += (characterTrait == weaponTrait) ? 0.075 : 0
        traitBonus += (
            characterTrait == enemyTrait-1 || 
            (characterTrait == 3 && enemyTrait == 0)
        ) ? 0.075 : 0
        traitBonus += (
            characterTrait-1 == enemyTrait || (characterTrait == 0 && enemyTrait == 3)
        ) ? -0.075 : 0
        let tempfinalPlayerPower = parseInt(playerPower * (1 + traitBonus))
        let tempEnemyPower = (target & 0xFFFFFF)
        let diffPower =  tempfinalPlayerPower - tempEnemyPower
        if(diffPower > diffPowerFinal || diffPowerFinal == 0){
            targetSelected = target
            diffPowerFinal = diffPower
            enemyPower = tempEnemyPower
            finalPlayerPower = tempfinalPlayerPower
        }
    }

    return{
        finalPlayerPower,
        targetSelected,
        enemyPower
    }
}

async function checkExperienceToClaim(character){
    let heroLevel = await characterContract.methods.getLevel(character).call();
    let nextChangeLevel = parseInt(heroLevel / 10) * 10 + 11
    let expRequired = 0
    for(let level = heroLevel; level < nextChangeLevel - 1; level++){
        expRequired += EXPERIENCE_TABLE[level]
    }
    let heroXp = await characterContract.methods.getXp(character).call();
    expRequired -= heroXp
    let xpRewards = await gameContract.methods.getXpRewards(character).call();

    return xpRewards >= expRequired
}

async function claimXpRewards(account, privateKey){
    let dataClaimExp = gameContract.methods.claimXpRewards().encodeABI()

    return new Promise(async (r, rj) => {
        await web3.eth.getTransactionCount(account, async(err, txCount) => {
            const txObject = {
                nonce:    web3.utils.toHex(txCount),
                from:     account,
                to:       gameAddress,
                data:     dataClaimExp,
                value:    web3.utils.toHex(web3.utils.toWei('0', 'ether')),
                gasLimit: web3.utils.toHex(500000),
                gasPrice: web3.utils.toHex(web3.utils.toWei('5', 'gwei'))
            }
        
            const tx = new Tx(txObject)
            tx.sign(privateKey)
            const serializedTx = tx.serialize()
            const raw = '0x' + serializedTx.toString('hex')
    
            await web3.eth.sendSignedTransaction(raw,(err, txHash)=>{
                if(err != null){
                    console.log(err)
                    rj(err)
                }
                console.log("Exp claimed. Tx: ", txHash)
            }).once('receipt', r)
        })
    })
}

async function fight(character, weapon, target, account, privateKey, staminaMultiplier){   
    let dataFight = gameContract.methods.fight(character, weapon, target, staminaMultiplier).encodeABI()

    return new Promise((r, rj) => {
        web3.eth.getTransactionCount(account, async(err, txCount) => {
            const txObject = {
                nonce:    web3.utils.toHex(txCount),
                from:     account,
                to:       gameAddress,
                data:     dataFight,
                value:    web3.utils.toHex(web3.utils.toWei('0', 'ether')),
                gasLimit: web3.utils.toHex(500000),
                gasPrice: web3.utils.toHex(web3.utils.toWei('5', 'gwei'))
            }

            const tx = new Tx(txObject)
            tx.sign(privateKey)
            const serializedTx = tx.serialize()
            const raw = '0x' + serializedTx.toString('hex')

            let resultTx;

            await web3.eth.sendSignedTransaction(raw,(err, txHash)=>{
                if(err != null){
                    console.log(err)
                    rj(err)
                }
                resultTx = txHash
                console.log(txHash)
            }).once('receipt', async(receipt) => {
                let data = receipt.logs[0].data
                let topics = [receipt.logs[0].topics[1], receipt.logs[0].topics[2]]
                
                let result = await web3.eth.abi.decodeLog(
                    [
                        {type: 'address', name: 'owner', indexed: true}, 
                        {type: 'uint256', name: 'character', indexed: true}, 
                        {type: 'uint256', name: 'weapon'}, 
                        {type: 'uint32', name: 'target'}, 
                        {type: 'uint24', name: 'playerRoll'}, 
                        {type: 'uint24', name: 'enemyRoll'}, 
                        {type: 'uint16', name: 'xpGain'}, 
                        {type: 'uint256', name: 'skillGain'}
                    ], data, topics
                )

                r(result)
            })
        })
    })
}

async function match(character, weapons, chance = 90) {
    let weaponSelected
    let targetSelected
    let enemyPowerSelected
    let finalWinChance = 0

    for (let x = 0; x < weapons.length; x++) {
        let weapon = weapons[x]
        let fightSelected = await selectEnemy(character, weapon)
        let winChance = calculateWinChances(
            fightSelected.finalPlayerPower,
            fightSelected.enemyPower
        )

        if (winChance > finalWinChance) {
            weaponSelected = weapon
            targetSelected = fightSelected.targetSelected
            finalWinChance = winChance
            enemyPowerSelected = fightSelected.enemyPower
        }
    }

    if (finalWinChance < chance) return null

    return {
        weaponSelected,
        targetSelected,
        finalWinChance
    }
}

module.exports = {
    selectEnemy,
    calculateWinChances,
    match,
    fight,
    claimXpRewards,
    checkExperienceToClaim
}
