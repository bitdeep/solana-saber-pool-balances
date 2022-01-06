import * as fs from 'fs';
import * as anchor from '@project-serum/anchor';
import {QuarrySDK} from '@quarryprotocol/quarry-sdk'
import {SignerWallet, SolanaProvider} from '@saberhq/solana-contrib';
import {clusterApiUrl, Connection, Keypair, PublicKey} from '@solana/web3.js';
import * as st from '@saberhq/token-utils';

const FIGMENT_PERSONAL_NODE = 'http://209.145.54.213:8080/'
// clusterApiUrl('mainnet-beta')
export const makeProvider = () => {
    return SolanaProvider.load({
        connection: new Connection(
            FIGMENT_PERSONAL_NODE, 'confirmed',
        ),
        wallet: new SignerWallet(Keypair.generate()),
    });
};


function lamportsToString(lamports: anchor.BN): string {
    if (lamports.byteLength() > 7) {
        return "unlimited"
    } else {
        return (parseFloat(lamports.toString()) / anchor.web3.LAMPORTS_PER_SOL).toString()
    }
}

async function getRewardInfo(rewarder: string, token: string, wallet: string) {
    const provider = await makeProvider()
    const quarrySDK = QuarrySDK.load({provider})
    const rewarderPubkey = new anchor.web3.PublicKey(rewarder)
    const rewarderWrapper = await quarrySDK!.mine.loadRewarderWrapper(rewarderPubkey)
    const quarryWrapper = await rewarderWrapper.getQuarry(st.Token.fromMint(token, 9));

    const authrityKey = new anchor.web3.PublicKey(wallet);
    const miner = await quarryWrapper.getMiner(authrityKey);

    let result = {rewardsEarned: '0', balance: '0', rewards: '0'}
    if (!miner) {
        return result;
    }

    const rewards = quarryWrapper.payroll.calculateRewardsEarned(
        new anchor.BN(Math.round(new Date().getTime() / 1000)),
        miner.balance, miner.rewardsPerTokenPaid, miner.rewardsEarned)

    result.rewardsEarned = lamportsToString(miner.rewardsEarned);
    result.balance = lamportsToString(miner.balance);
    result.rewards = lamportsToString(rewards);
    return result;
}

async function main( userWallet:string ) {

    const rewardersInfo = JSON.parse(fs.readFileSync('./all-rewarders-with-info.json', 'utf-8'));
    for (let rewarder in rewardersInfo) {
        const r = rewardersInfo[rewarder];
        if (!r.info) continue;
        if (!r.quarries) continue;
        const name = r.info.name;

        // DEV: remove this!
        if( rewarder != DEBUG_ONLY_REWARDER )
            continue;// remove this, testing only

        console.log(rewarder, name);
        const pools = r.quarries.length;
        for (let i = 0; i < pools; i++) {
            try {
                const res: any = await getRewardInfo(rewarder, r.quarries[i].stakedToken.address, userWallet);
                let rew = {
                    token: r.quarries[i].stakedToken.address,
                    decimals: r.quarries[i].stakedToken.decimals,
                    reward: {
                        rewardsEarned: res.rewardsEarned,
                        balance: res.balance,
                        rewards: res.rewards
                    }
                }
                if (res.balance > 0) {
                    console.log(' ', rew.token, rew.reward.balance, rew.reward.rewards, rew.reward.rewardsEarned)
                }
            } catch (e) {
                console.log(e);
            }
        }
    }

}

const DEBUG_ONLY_REWARDER = 'rXhAofQCT7NN9TUqigyEAUzV1uLL4boeD8CRkNBSkYk';
const USER_WALLET = '3LaMdD7uHQwcBJnxnw5bAmYxvCb9wBKwiZvjKw6iEYRS';
main(USER_WALLET);
