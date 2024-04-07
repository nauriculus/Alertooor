const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { mplTokenMetadata } = require ('@metaplex-foundation/mpl-token-metadata');
const {
  fetchDigitalAsset,
} = require ('@metaplex-foundation/mpl-token-metadata');

const { Connection, PublicKey} = require('@solana/web3.js');

const token = '';

const options = {
  cert: fs.readFileSync('/etc/letsencrypt/live/certificate.crt'),
  ca: fs.readFileSync('/etc/letsencrypt/live/ca_bundle.crt'),
  key: fs.readFileSync('/etc/letsencrypt/live/private.key')
};

const raydium = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

const bot = new TelegramBot(token, {polling: true});
const app = express();

app.use(bodyParser.json());
const port = 6968;

https.createServer(options, app).listen(port, () => {
  console.log(`Server is running on https://localhost:${port}`);
});

const connection = new Connection("https://");

//Helius Webhook (PumpFun contract)
app.post('/bonkdegen', async (req, res) => {
  await Promise.all(req.body.map(async (obj) => {
      const sig = obj.signature;
      if (obj.type === "TOKEN_MINT") {
          let supply;
          let tokenMint;
          let transferAmount = 0; 
          const tokenCreator = obj.feePayer;
          const tokenTransfers = obj.tokenTransfers;
          for (let i = 0; i < tokenTransfers.length; i++) {
              const token = tokenTransfers[i];
              if (i === 0) {
                  const amount = token.tokenAmount;
                  supply = amount;
                  tokenMint = token.mint;
              } else if (i === 1) {
                  const amount = token.tokenAmount;
                  transferAmount = amount;
              }
          }

          const percentageTransferred = (transferAmount / supply) * 100;
          const poolPercentage = 100 - percentageTransferred;

          await delay(50000);
          const umi = createUmi(connection).use(mplTokenMetadata());

          const token = new PublicKey("" + tokenMint);

          const asset = await fetchDigitalAsset(umi, token)

          const tokenName = asset.metadata.name;
          const ticker =  asset.metadata.symbol;
           

          let message = `NEW TOKEN LAUNCHED\n\n`;
        
          message += `📈 Token Name: ${tokenName}\n\n`;
          message += `💰 CA: $${ticker}\n\n`;
          message += `👤 Token Deployer: ${tokenCreator}\n\n`;
          message += `💎 Token Supply: ${supply}\n\n`;

          if (transferAmount !== 0) {
              message += `💸 Token Transfer Amount: ${transferAmount}\n\n`;
          } else {
              message += `🚫 All tokens taken by the creator\n`;
          }

          message += `\n📊 Token Distribution:\n\n`;
          message += `👨‍🔬 Creator Holds: ${percentageTransferred.toFixed(2)}% of the total supply\n`;
          message += `🏦 Pool Holds: ${poolPercentage.toFixed(2)}% of the total supply\n`;

          bot.sendMessage("-1002120551743", message, {
                reply_markup: {
                inline_keyboard: [
                    [{ text: 'BonkBot', url: 'https://t.me/bonkbot_bot?start=ref_g7d2x_ca_' + tokenMint }],
                    [{ text: 'BirdEye', url: 'https://birdeye.so/token/' + tokenMint }],
                    [{ text: 'Solscan', url: 'https://solscan.io/tx/' + sig }],
                ]
            }
        });         
      }
  }));
});

  async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async function fetchData(txId, connection) {
    try {
          const tx = await connection.getParsedTransaction(
              txId,
              {
                  maxSupportedTransactionVersion: 0,
                  commitment: 'confirmed'
            });

          const accounts = tx?.transaction.message.instructions.find(ix => ix.programId.toBase58() === raydium.toBase58()).accounts;
          const signer = tx?.transaction.message.accountKeys[0];
        
          const publicKeyObject = signer.pubkey;
          const publicKeyString = publicKeyObject.toBase58();
          const tokenAIndex = 8;
  
          if (!accounts) {
              console.log("No accounts found in the transaction.");
              return;
          }

          const token = accounts[tokenAIndex];
          console.log("New pool launched for token: " + token + " signature: " + txId);
         
          const umi = createUmi(connection).use(mplTokenMetadata());

          const tokenMint = new PublicKey("" + token);
          const asset = await fetchDigitalAsset(umi, tokenMint)
 
          const tokenName = asset.metadata.name;
          const ticker =  asset.metadata.symbol;

          let message = `NEW POOL LAUNCHED\n\n`;
          
          message += `📈 Token Name: ${tokenName}\n\n`;
          message += `💰 CA: $${ticker}\n\n`;
          message += `👤 Pool Deployer: ${publicKeyObject}\n\n`;

          bot.sendMessage("-1002120551743", message, {
                reply_markup: {
                inline_keyboard: [
                    [{ text: 'BonkBot', url: 'https://t.me/bonkbot_bot?start=ref_g7d2x_ca_' + token }],
                    [{ text: 'BirdEye', url: 'https://birdeye.so/token/' + token }],
                    [{ text: 'Solscan', url: 'https://solscan.io/tx/' + txId }],
                ]
            }
        });       
        
  }catch(error) {
     console.log(error);
  }
  }

  connection.onLogs(
    raydium,
    ({ logs, err, signature }) => {
        if (err) {
          return;
        }
        if (logs.some(log => log.includes("initialize2"))) {
          fetchData(signature, connection);
        }
    },
    "finalized"
  );