pragma solidity >=0.4.22 <0.6.0;

contract BlockchainSplitwise {
    
    
    struct User {
        mapping (address => uint32) debts;
        uint timestamp;
    }
    
    mapping (address => User) public users;
    
    function lookup(address debtor, address creditor) public view returns (uint32 ret) {
        return users[debtor].debts[creditor];
    }
    
    
    function add_IOU(address creditor, uint32 amount, address[] memory cycle, uint32 minDebt) public {
        require (amount >= 0, 'Negative amount');
        require (minDebt >= 0, 'Negative minDebt');
        
        if(cycle.length == 0){
            users[msg.sender].debts[creditor] += amount;
        } else {
            // Check that sender is in the end of the cycle
            for(uint i = 0; i < (cycle.length - 1); i++){
                require(lookup(cycle[i], cycle[i+1]) >= minDebt);
                users[cycle[i]].debts[cycle[i+1]] -= minDebt;
            }
            
            users[cycle[cycle.length-1]].debts[cycle[0]] += amount;
            users[cycle[cycle.length-1]].debts[cycle[0]] -= minDebt;
            
                
        }
        
        update_timestamp(msg.sender);
        update_timestamp(creditor);
        
    }
    
    function update_timestamp(address user) public {
        users[user].timestamp = block.timestamp;
    }
    
    function get_timestamp(address user) public view returns (uint timestamp){
        return users[user].timestamp;
    }
    

    
}