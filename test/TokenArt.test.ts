import { accounts, contract } from "@openzeppelin/test-environment";
const testHelpers = require("@openzeppelin/test-helpers");
import { expect } from "chai";
import "mocha";

const TestableERC20 = contract.fromArtifact("TestableERC20");
const TestableERC1155 = contract.fromArtifact("TestableERC1155");
const TokenArt = contract.fromArtifact("TokenArt");

interface TokenArtTestingVars {
    joe: string;
    sophie: string;
    tokenArt: any;
    potatoToken: any;
    tofuToken: any;
    dankNugs: any;
    sillyFlowers: any;
    doug: string;
}
const setupTestingEnvironment = async (info: {potatoJoeAmount: number; potatoSophieAmount: number; tofuJoeAmount: number; tofuSophieAmount: number;}): Promise<TokenArtTestingVars> => {
    const [joe, sophie, doug] = accounts;
        
    const tokenArt = await TokenArt.new({from: joe}) ;
 
    const potatoToken = await TestableERC20.new() ;
    await potatoToken.mint(joe, testHelpers.ether(info.potatoJoeAmount.toString()).toString());
    await potatoToken.approve(tokenArt.address, testHelpers.ether(info.potatoJoeAmount.toString()), {from:joe});
    await potatoToken.mint(sophie, testHelpers.ether(info.potatoSophieAmount.toString()).toString());
    await potatoToken.approve(tokenArt.address, testHelpers.ether(info.potatoSophieAmount.toString()), {from:sophie});

    
    const tofuToken = await TestableERC20.new();
    await tofuToken.mint(joe, testHelpers.ether(info.tofuJoeAmount.toString()));
    await tofuToken.approve(tokenArt.address, testHelpers.ether(info.tofuJoeAmount.toString()), {from:joe});
    await tofuToken.mint(sophie, testHelpers.ether(info.tofuSophieAmount.toString()));
    await tofuToken.approve(tokenArt.address, testHelpers.ether(info.tofuSophieAmount.toString()), {from:sophie});
    
    const dankNugs = await TestableERC1155.new();
    await dankNugs.setApprovalForAll(tokenArt.address, true, {from: joe});
    await dankNugs.setApprovalForAll(tokenArt.address, true, {from: sophie});
    
    const sillyFlowers = await TestableERC1155.new();
    await sillyFlowers.setApprovalForAll(tokenArt.address, true, {from: joe});
    await sillyFlowers.setApprovalForAll(tokenArt.address, true, {from: sophie});
    
    return {
        joe,
        sophie,
        tokenArt,
        potatoToken,
        tofuToken,
        dankNugs,
        sillyFlowers,
        doug
    }
}

const assertBnEthAmount = async (a: any, ethAmount: number) => {
    expect((await a).toString()).to.eql(testHelpers.ether(ethAmount.toString()).toString());
}

const assertBnRegAmount = async (a: any, regAmount: number) => {
    expect((await a).toString()).to.eql(regAmount.toString());
}

const elevateAndAssert = async (testVars: TokenArtTestingVars) => {
        const { dankNugs, tokenArt, potatoToken, tofuToken, joe, sophie} = testVars;

        // mint 50 dank nug art piece with id 420
        await dankNugs.mint(joe, 420, 50);
    
        const firstTokenArtId = 1;
        
        // first nug tokenart
        const elevatedRes = await tokenArt.elevate(
            dankNugs.address,
            420,
            3,
            [potatoToken.address, tofuToken.address],
            [testHelpers.ether('11'), testHelpers.ether('12')],
            0,
            false,
            'some metadata',
            {from: joe}
        );
        // ensure event
        const elevatedEvent = elevatedRes.logs.find((l: any) => l.event === 'Elevated');
        expect(elevatedEvent).to.not.eql(undefined);
        
        // check to ensure joes erc20 tokens are gone
        await assertBnEthAmount(potatoToken.balanceOf(joe), 57);
        // ensures joes tofu tokens are gone
        await assertBnEthAmount(tofuToken.balanceOf(joe), 4);
        // ensures sophies tokens didnt change
        await assertBnEthAmount(potatoToken.balanceOf(sophie), 95);
        await assertBnEthAmount(tofuToken.balanceOf(sophie), 45);
        
        // ensure contract has the erc20 tokens
        await assertBnEthAmount(potatoToken.balanceOf(tokenArt.address), 33);
        await assertBnEthAmount(tofuToken.balanceOf(tokenArt.address), 36);
    
        // ensure contract has the three of the erc1155s
        await assertBnRegAmount(dankNugs.balanceOf(tokenArt.address, 420), 3);
        // ensure joe has the rest
        await assertBnRegAmount(dankNugs.balanceOf(joe, 420), 47);

        // esnure new tokenArt ERC1155s are minted
        await assertBnRegAmount(tokenArt.balanceOf(joe, firstTokenArtId), 3);

        
        const details = await tokenArt.getDetails([firstTokenArtId]);
        const [storedERC20TokenAddresses,storedERC20TokenAmounts, storedERC20TokensAvailableAt,embeddedErc1155Address, embeddedErc1155Id, numPiecesElevated,burnEmbeddedPieceWhenUnelevated,metadata] = details[0][0];

        expect(
            [...storedERC20TokenAddresses].sort()
        ).to.eql([potatoToken.address, tofuToken.address].sort());
        expect(embeddedErc1155Address).to.eql(dankNugs.address);
        expect(embeddedErc1155Id.toString()).to.eql('420');
        expect(numPiecesElevated.toString()).to.eql('3');
        expect(storedERC20TokensAvailableAt.toString()).to.eql('0');
        expect(burnEmbeddedPieceWhenUnelevated).to.eql(false);
        expect(metadata).to.eql('some metadata');
        expect(storedERC20TokenAddresses).to.eql([potatoToken.address, tofuToken.address]);
        expect(storedERC20TokenAmounts.map((a: any) => a.toString())).to.eql(['11000000000000000000', '12000000000000000000']);
        
        const creator = details[1][0];
        expect(creator).to.eql(joe);
        
}

describe("TokenArt", function() {
    this.timeout(50000); 
    
    it("should mint and unelevate", async () => {
        // ----- elevate ----
        const testingVars = await setupTestingEnvironment({
            potatoJoeAmount: 90,
            tofuJoeAmount: 40,
            potatoSophieAmount: 95,
            tofuSophieAmount: 45
        });
        const { joe, sophie, tokenArt, potatoToken, tofuToken, dankNugs, sillyFlowers, doug} = testingVars;
        await elevateAndAssert(testingVars);


        // ---- unelevate 2 pieces---
        const unelevateRes = await testingVars.tokenArt.unelevate(1, 2, {from: joe});
        // ensure event
        const unelevatedEvent = unelevateRes.logs.find((l: any) => l.event === 'Unelevated');
        expect(unelevatedEvent).to.not.eql(undefined);

        // ensures tokenart was burned
        await assertBnRegAmount(tokenArt.balanceOf('0x0000000000000000000000000000000000000001', 1), 2);
        // ensure joe still has 1
        await assertBnRegAmount(tokenArt.balanceOf(joe, 1), 1);

        // ensure original erc1155 was transferred to joe
        await assertBnRegAmount(dankNugs.balanceOf(tokenArt.address, 420), 1);
        await assertBnRegAmount(dankNugs.balanceOf(joe, 420), 49);
        
        // ensure ERC20s transferred to user
        await assertBnEthAmount(potatoToken.balanceOf(joe), 57+(11*2));
        await assertBnEthAmount(tofuToken.balanceOf(joe), 4+(12*2));
        
        // ensures sophies tokens didnt change
        await assertBnEthAmount(potatoToken.balanceOf(sophie), 95);
        await assertBnEthAmount(tofuToken.balanceOf(sophie), 45);
        
        
        // unelevate last 1
        await testingVars.tokenArt.unelevate(1, 1, {from: joe});
        // ensures tokenart was burned
        await assertBnRegAmount(tokenArt.balanceOf('0x0000000000000000000000000000000000000001', 1), 3);
        // ensure joe has none
        await assertBnRegAmount(tokenArt.balanceOf(joe, 1), 0);
        
        // ensure original erc1155 was transferred to joe
        await assertBnRegAmount(dankNugs.balanceOf(tokenArt.address, 420), 0);
        await assertBnRegAmount(dankNugs.balanceOf(joe, 420), 50);
        
        
        // ensure ERC20s transferred to joe
        await assertBnEthAmount(potatoToken.balanceOf(joe), 90);
        await assertBnEthAmount(tofuToken.balanceOf(joe), 40);
        
        // ensures sophies tokens didnt change
        await assertBnEthAmount(potatoToken.balanceOf(sophie), 95);
        await assertBnEthAmount(tofuToken.balanceOf(sophie), 45);
    });
    

    it("should only allow appropriate unelevations", async () => {
        // ----- elevate ----
        const testingVars = await setupTestingEnvironment({
        potatoJoeAmount: 90,
        tofuJoeAmount: 40,
        potatoSophieAmount: 95,
        tofuSophieAmount: 45
        });
        const { joe, sophie, tokenArt, potatoToken, tofuToken, dankNugs, sillyFlowers, doug} = testingVars;
        await elevateAndAssert(testingVars); 
        
        // can't elevate pieces dont own
        await testHelpers.expectRevert(
            testingVars.tokenArt.unelevate(1, 2, {from: sophie}),
            "Must own pieces"
        );
        
        // cant elevate more pieces than you have
        await testHelpers.expectRevert(
            testingVars.tokenArt.unelevate(1, 4, {from: joe}),
            "Must own pieces"
        );
        
        const res = await testingVars.tokenArt.unelevate(1, 3, {from: joe});
        expect(res.logs[2].event).to.eql('Unelevated');
    });
    
    // TODO: test retrieving tip
    
    // test: multiple items
    
    // test: timelock
    
    // TODO: try with 1 token
    
    // TODO: test URI fn
})