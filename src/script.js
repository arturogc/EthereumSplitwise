// =============================================================================
//                                  Config 
// =============================================================================

// sets up web3.js
if (typeof web3 !== 'undefined')  {
	web3 = new Web3(web3.currentProvider);
} else {
	web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
}

// Default account is the first one
web3.eth.defaultAccount = web3.eth.accounts[0];
// Constant we use later
var GENESIS = '0x0000000000000000000000000000000000000000000000000000000000000000';

// This is the ABI for the contract (get it from Remix, in the 'Compile' tab)
// ============================================================
var abi = [
	{
		"constant": false,
		"inputs": [
			{
				"name": "creditor",
				"type": "address"
			},
			{
				"name": "amount",
				"type": "uint32"
			},
			{
				"name": "cycle",
				"type": "address[]"
			},
			{
				"name": "minDebt",
				"type": "uint32"
			}
		],
		"name": "add_IOU",
		"outputs": [],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"constant": false,
		"inputs": [
			{
				"name": "user",
				"type": "address"
			}
		],
		"name": "update_timestamp",
		"outputs": [],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [
			{
				"name": "user",
				"type": "address"
			}
		],
		"name": "get_timestamp",
		"outputs": [
			{
				"name": "timestamp",
				"type": "uint256"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [],
		"name": "getUser_list",
		"outputs": [
			{
				"name": "usersList",
				"type": "address[]"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [
			{
				"name": "debtor",
				"type": "address"
			},
			{
				"name": "creditor",
				"type": "address"
			}
		],
		"name": "lookup",
		"outputs": [
			{
				"name": "ret",
				"type": "uint32"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [
			{
				"name": "",
				"type": "uint256"
			}
		],
		"name": "user_list",
		"outputs": [
			{
				"name": "",
				"type": "address"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [
			{
				"name": "",
				"type": "address"
			}
		],
		"name": "users",
		"outputs": [
			{
				"name": "exists",
				"type": "bool"
			},
			{
				"name": "timestamp",
				"type": "uint256"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	}
]; 
// ============================================================
abiDecoder.addABI(abi);
// call abiDecoder.decodeMethod to use this - see 'getAllFunctionCalls' for more

// Reads in the ABI
var BlockchainSplitwiseContractSpec = web3.eth.contract(abi);

// This is the address of the contract we want to connect to; copy this from Remix
var contractAddress = '0xbd44bff86b3f9ba58b09853df28374d74b507b1a' // FIXME: fill this in with your contract's address/hash

var BlockchainSplitwise = BlockchainSplitwiseContractSpec.at(contractAddress)


// =============================================================================
//                            		Functions
// =============================================================================


// Finds the neighbours of 'node' (string) and returns them in a 'neighbors' (list) 
function findNeighbors(node) {
	var neighbors = [];
	var users = getUsers();
	for(var i = 0; i < users.length; i++) {
		if(BlockchainSplitwise.lookup(node,users[i]).toNumber() > 0){
			neighbors.push(users[i]); // If the neighbor is a creditor
		} 
		//else if(BlockchainSplitwise.lookup(user,node).toNumber() > 0) {
		//	neighbors.push(user); // If the neighbor is a debtor
		//}
	}
	return neighbors;
}

// Return a list of all users (creditors or debtors) in the system
function getUsers() {
	var IOU_calls = getAllFunctionCalls(contractAddress, 'add_IOU');
	var users = [];

	for (var i = 0; i < IOU_calls.length; i++) {
		if (!users.includes(IOU_calls[i].from)) {
			users.push(IOU_calls[i].from);
		}

		if(!users.includes(IOU_calls[i].args[0])){
			users.push(IOU_calls[i].args[0]);
		}
	}
	return users;
}

// Get the total amount owed by the user specified by 'user'
function getTotalOwed(user) { // Suppose not net
	var owed_amount = 0;
	var neighbors = findNeighbors(user);
	for(var i = 0; i < neighbors.length; i++) {
		var debt = BlockchainSplitwise.lookup(user, neighbors[i]).toNumber();
		owed_amount += debt;
	}
	return owed_amount;
}

// Get the last time this user has sent or received an IOU, in seconds since Jan. 1, 1970
// Returns null if can't find any activity for the user.
function getLastActive(user) {
// Get all the add_IOU calls, and check the first including our user (either as creditor or sender)
	var IOU_calls = getAllFunctionCalls(contractAddress, 'add_IOU');
	for (var i = 0; i < IOU_calls.length; i++) {
		if (IOU_calls[i].from === user || IOU_calls[i].args[0] == user){
			var ts = BlockchainSplitwise.get_timestamp(user);
			if(ts === 0){
				return null;
			}else{
				return ts;
			}
		}
	}
	return null;
}

// Add an IOU ('I owe you') to the system
// The person you owe money is passed as 'creditor'
// The amount you owe them is passed as 'amount'
function add_IOU(creditor, amount) {
	var loop = doBFS(creditor, web3.eth.defaultAccount, findNeighbors);

	if(loop === null){
		var cycle = [];
		BlockchainSplitwise.add_IOU(creditor, amount, cycle, 0); // Problem: running out of gas
	} else {
		// Select minimum
		var minDebt = amount; // Initialize minimum debt with paying amount
		for(var i = 0; i < (loop.length-1); i++){ // If length = 1?
			var debt = BlockchainSplitwise.lookup(loop[i], loop[i+1]).toNumber();
			if(debt < minDebt){
				minDebt = debt;
			}
		}

		BlockchainSplitwise.add_IOU(creditor, amount, loop, minDebt)
		
	}

}

// =============================================================================
//                              Provided Functions 
// =============================================================================

// This searches the block history for all calls to 'functionName' (string) on the 'addressOfContract' (string) contract
// It returns an array of objects, one for each call, containing the sender ('from') and arguments ('args')
function getAllFunctionCalls(addressOfContract, functionName) {
	var curBlock = web3.eth.blockNumber;
	var function_calls = [];
	while (curBlock !== GENESIS) {
	  var b = web3.eth.getBlock(curBlock, true);
	  var txns = b.transactions;
	  for (var j = 0; j < txns.length; j++) {
	  	var txn = txns[j];
	  	// check that destination of txn is our contract
	  	if (txn.to === addressOfContract) {
	  		var func_call = abiDecoder.decodeMethod(txn.input);
	  		// check that the function getting called in this txn is 'functionName'
	  		if (func_call && func_call.name === functionName) {
	  			var args = func_call.params.map(function (x) {return x.value});
	  			function_calls.push({
	  				from: txn.from,
	  				args: args
	  			})
	  		}
	  	}
	  }
	  curBlock = b.parentHash;
	}
	return function_calls;
}

// Breadth-first search implementation
// It will find a path from start to end (or return null if none exists)
// You just need to pass in a function ('getNeighbors') that takes a node (string) and returns its neighbors (as an array)
function doBFS(start, end, getNeighbors) {
	var queue = [[start]];
	while (queue.length > 0) {
		var cur = queue.shift();
		var lastNode = cur[cur.length-1]
		if (lastNode === end) {
			return cur;
		} else {
			var neighbors = getNeighbors(lastNode);
			for (var i = 0; i < neighbors.length; i++) {
				queue.push(cur.concat([neighbors[i]]));
			}
		}
	}
	return null;
}
// =============================================================================
//                                      UI 
// =============================================================================

// This code updates the 'My Account' UI with the results of your functions
$("#total_owed").html("$"+getTotalOwed(web3.eth.defaultAccount));
$("#last_active").html(timeConverter(getLastActive(web3.eth.defaultAccount)));
$("#myaccount").change(function() {
	web3.eth.defaultAccount = $(this).val();
	$("#total_owed").html("$"+getTotalOwed(web3.eth.defaultAccount));
	$("#last_active").html(timeConverter(getLastActive(web3.eth.defaultAccount)))
});

// Allows switching between accounts in 'My Account' and the 'fast-copy' in 'Address of person you owe
var opts = web3.eth.accounts.map(function (a) { return '<option value="'+a+'">'+a+'</option>' })
$(".account").html(opts);
$(".wallet_addresses").html(web3.eth.accounts.map(function (a) { return '<li>'+a+'</li>' }))

// This code updates the 'Users' list in the UI with the results of your function
$("#all_users").html(getUsers().map(function (u,i) { return "<li>"+u+"</li>" }));

// This runs the 'add_IOU' function when you click the button
// It passes the values from the two inputs above
$("#addiou").click(function() {
  add_IOU($("#creditor").val(), $("#amount").val());
  window.location.reload(true); // refreshes the page after
});

// This is a log function, provided if you want to display things to the page instead of the JavaScript console
// Pass in a discription of what you're printing, and then the object to print
function log(description, obj) {
	$("#log").html($("#log").html() + description + ": " + JSON.stringify(obj, null, 2) + "\n\n");
}


