const { ethers, network } = require("hardhat")
const { moveblocks } = require("../utils/move-blocks")
const TOKEN_ID = 2

async function buyItem() {
    const nftMarketplace = await ethers.getContract("NftMarketplace")
    const basicNft = await ethers.getContract("BasicNft")
    const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
    const price = listing.price.toString()
    const tx = await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: price })
    await tx.wait(1)
    console.log("Bought NFT!")
    if ((network.config.chainId = "31337")) {
        await moveblocks(2, (sleepAmount = 1000))
    }
}
