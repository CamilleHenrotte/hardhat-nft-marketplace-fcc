const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NftMarketplace", () => {
          let nftMarketplace, deployer, player, basicNft
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0
          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              const accounts = await ethers.getSigners()
              player = accounts[1]
              await deployments.fixture(["nftMarketplace", "basicNft"])
              nftMarketplace = await ethers.getContract("NftMarketplace", deployer)
              basicNft = await ethers.getContract("BasicNft", deployer)
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplace.address, TOKEN_ID)
          })
          describe("listItem", () => {
              it("adds an item to the listing correctly", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == PRICE.toString())
                  assert(listing.seller.toString() == deployer.toString())
              })
              it("reverts if it is already listed", async () => {
                  const error = `NftMarketplace__AlreadyListed("${basicNft.address}", ${TOKEN_ID})`
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error)
              })
              it("reverts if the market place is not approved", async () => {
                  const error = `NftMarketplace__NotApprovedForMarketplace()`
                  const TOKEN_ID_NOT_APPROVED = 1
                  await basicNft.mintNft()
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID_NOT_APPROVED, PRICE)
                  ).to.be.revertedWith(error)
              })
              it("reverts if the sender is not the owner", async () => {
                  const error = "NftMarketplace__NotOwner()"
                  const playerConnectedMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error)
              })
              it("reverts if the price is 0", async () => {
                  const error = "NftMarketplace__PriceMustBeAboveZero()"
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, 0)
                  ).to.be.revertedWith(error)
              })
              it("emits an event after listing an item", async () => {
                  expect(await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE))
                      .to.emit("ItemListed")
                      .withArgs(deployer, basicNft.address, TOKEN_ID, PRICE)
              })
          })
          describe("cancelListing", async () => {
              beforeEach(async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
              })
              it("reverts if the sender is not the owner", async () => {
                  const error = "NftMarketplace__NotOwner()"
                  const playerConnectedMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith(error)
              })
              it("reverts if is not listed", async () => {
                  await basicNft.mintNft()
                  const UNLISTED_TOKEN_ID = 1
                  const error = `NftMarketplace__NotListed("${basicNft.address}", ${UNLISTED_TOKEN_ID})`
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, UNLISTED_TOKEN_ID)
                  ).to.be.revertedWith(error)
              })
              it("delete the item from the listing", async () => {
                  await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == "0")
              })
              it("emits an event", async () => {
                  expect(await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  )
              })
          })
          describe("buyItem", async () => {
              it("transfers the nft to the buyer and updates internal proceeds record", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedMarketplace = nftMarketplace.connect(player)
                  await playerConnectedMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketplace.getProceeds(deployer)
                  assert(newOwner == player.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })
              it("reverts if the price is not met", async () => {
                  const PRICE_LOWER = ethers.utils.parseEther("0.05")
                  const error = `NftMarketplace__PriceNotMet("${basicNft.address}", ${TOKEN_ID}, ${PRICE})`
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE_LOWER,
                      })
                  ).to.be.revertedWith(error)
              })
              it("reverts if the nft is not listed", async () => {
                  const error = `NftMarketplace__NotListed("${basicNft.address}", ${TOKEN_ID})`
                  const playerConnectedMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.be.revertedWith(error)
              })
          })
          describe("updateListing", async () => {
              const NEW_PRICE = ethers.utils.parseEther("2")
              it("reverts if the sender is not the owner", async () => {
                  const error = "NftMarketplace__NotOwner()"
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedMarketplace.updateListing(
                          basicNft.address,
                          TOKEN_ID,
                          NEW_PRICE
                      )
                  ).to.be.revertedWith(error)
              })
              it("reverts if the nft is not listed", async () => {
                  const error = `NftMarketplace__NotListed("${basicNft.address}", ${TOKEN_ID})`
                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEW_PRICE)
                  ).to.be.revertedWith(error)
              })
              it("updates the listing with a new price", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEW_PRICE)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == NEW_PRICE.toString())
              })
          })
          describe("withdrawProceeds", async () => {
              it("reverts if there is no proceed", async () => {
                  const error = "NftMarketplace__NoProceeds()"
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(error)
              })
              it("retreive the proceeds", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedMarketplace = nftMarketplace.connect(player)
                  await playerConnectedMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })

                  const deployerProceedsBefore = await nftMarketplace.getProceeds(deployer)
                  const deployerBalanceBefore = await ethers.provider.getBalance(deployer)
                  const txResponse = await nftMarketplace.withdrawProceeds()
                  const transactionReceipt = await txResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const deployerBalanceAfter = await ethers.provider.getBalance(deployer)

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerProceedsBefore.add(deployerBalanceBefore).toString()
                  )
              })
          })
      })
