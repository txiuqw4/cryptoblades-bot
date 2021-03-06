const {match, fight, checkExperienceToClaim, claimXpRewards} = require('./game')
const {gameContract, characterContract} = require('./contract')
const accounts = require('./accounts.json')
const { MIN_STAMINA_COST_PER_FIGHT, MIN_CHANCE, CLAIM_EXP } = require('./options.json')

const data = accounts.map(r => ({
    'wallet': r.wallet,
    'characters': []
}))

const information = {
    combats: [],
    remainSeconds: 0,
    foughtAt: null,
    updatedAt: null
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms))
}

async function work() {
    let delay = 48000; // 800 minutes
    const SECONDS_PER_STAMINA = await characterContract.methods.secondsPerStamina().call()

    for(const account of accounts) {
        console.log('Wallet ', account.wallet)
        let pos = data.findIndex(r => r.wallet === account.wallet)
        let claimExp = false

        let characters = await gameContract.methods.getMyCharacters().call( { from: account.wallet } )
        let weapons = await gameContract.methods.getMyWeapons().call( { from: account.wallet } )

        for(const character of characters) {
            console.log('Checking character ', character)
            let idx = data[pos].characters.findIndex(r => r.id === character)
            if (idx === -1) {
                data[pos].characters.push({
                    id: character,
                    totalWins: 0,
                    totalLosses: 0,
                    skillEarned: 0
                })

                idx = data[pos].characters.length - 1
            }

            let stamina = Number(await characterContract.methods.getStaminaPoints(character).call())

            if (stamina < MIN_STAMINA_COST_PER_FIGHT) {
                let remainSeconds = (MIN_STAMINA_COST_PER_FIGHT - stamina) * SECONDS_PER_STAMINA
                console.log('not enough stamina, remain ', remainSeconds, 's')

                if (remainSeconds < delay) delay = remainSeconds
                continue
            }

            let m = await match(character, weapons, MIN_CHANCE)
            if (m === null) {
                const now = new Date()
                const remainSeconds = (60 - now.getMinutes()) * 60
                console.log('not match enemy with ', MIN_CHANCE, '% win chance. remain ', remainSeconds, 's')

                if (remainSeconds < delay) delay = remainSeconds
                continue
            }

            console.log(m)
            console.log('matched! ', m.finalWinChance, '% win chance.')
            console.log('-------------FIGHTING--------------')

            let privateKey = Buffer.from(account.key, 'hex')
            let staminaMultiplier = MIN_STAMINA_COST_PER_FIGHT / 40

            let result = await fight(character, m.weaponSelected, m.targetSelected, account.wallet, privateKey, staminaMultiplier)
            console.log(result)

            if(result.skillGain > 0){
                data[pos].characters[idx].totalWins += 1
                data[pos].characters[idx].skillEarned += (result.skillGain / 1e18)
            }else{
                data[pos].characters[idx].totalLosses += 1
            }

            information.foughtAt = new Date()
            information.combats.push({
                createdAt: new Date(),
                skillEarned: result.skillGain > 0 ? result.skillGain / 1e18 : 0,
                character: character,
                winChance: m.finalWinChance,
                wallet: account.wallet
            })

            await sleep(2000)

            claimExp = claimExp || await checkExperienceToClaim(character)
        }

        await sleep(5000)
        if (CLAIM_EXP && claimExp) {
            console.log('claim exp of account ', account.wallet)
            claimXpRewards(account.wallet, account.key)
        }
    }

    information.remainSeconds = delay
    information.updatedAt = new Date()
    console.log('wait ', delay, 's to next check')
    setTimeout(work, delay * 1000)
}

module.exports = {
    data,
    work,
    information
}
