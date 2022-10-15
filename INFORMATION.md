# Diep.io Parser

You may find a copy of my Diep.io parser [here](https://github.com/Altanis/lb-bot/blob/main/new_lb_bot/WebSocket/connection/helpers/parser.js) in JavaScript. This parser can parse any incoming clients, and generate any outgoing packets. This document will detail how packet structure works in verbatum.

## Incoming Packets
### **0x00: The `Update` Packet**
This packet is sent to the client to give instructions on how to render entities and other objects when playing Diep.io. 0x00 Packets are very large and as such are hard to decipher, let alone parse dynamically. 

The packet is organized in three sections: uptick, deletions, and upcreates.

The uptick tells the client how long the server has been running for. It is **XOR'd** by a random number which is randomized every new build. To reverse this XOR, you can make a RegExp to get the uptick in the WASM (as of `3/18/2022`, it was `/\d+ \^ \d+ \| 0;\s+HEAP32/` in the WASM2JS conversion of the WASM). 

The deletions are all the entities which have been removed from the game during that tick. The deletion count is also XOR'd by a random XOR generated per build added to the current gametick. The deletion count is given, then there would be a set of entities next to the count in order of `<hash, entityid>`.

The upcreates are the hardest part of the 0x00 packet to parse. An upcreate is a way to represent both updates and creations. The upcreate count is XOR'd by the current gametick added to the random XOR every build. A set of entity IDs is given in the format `<hash, entityid>`. After the entity ID is provided, there would be an unsigned integer detailing whether or not the entity has been updated or created (`0` for update, `1` for creation).

An update is parsed as a jump table, where `01` signifies the start and end of the table, and `00` signifies a new field. "Fields" are properties of an entity (`x`, `y`, `angle`, `size`, etc) and "field groups/components" are groups of field groups which share common aspects (e.g. `size` and `sides` because they both are physical properties of the entity).
After parsing the `01`, you will find relevant fields to the entity separated by a `00`. As it is a jump table, the jumps would be cumulative -- i.e., every element of the jump table depended on the element before. If you parse the byte after the jump (`00`) as an unsigned LEB128 and add it to the last jump index (0 if the first field), then you will get the field of that element, and using that you could parse it. You would repeat this (typically in a `while` loop) until the parsed unsigned LEB128 xord by one returns 0 (which would mean the next byte is `01`, signifying end of jump table).
If the entity has been created, then there will be bytes preceding a `01` (signifying creation). These are the field groups that the data belongs to; using this, we can parse the relevant data after the `01`. We will know when the creation data ends when it is terminated by a `01` byte.

A simpler explanation would be explaining the packet step by step, as such:
```js
00 // header
345647890 // uptime tick, XORd by a shuffled integer in memory
1 // deletion count, shows how many entities were deleted. XORd by a shuffled integer in memory
  01 02 // 2 varuints, which represent the hash and entity id (<1, 2> in this case). this is the deleted entity
2 // upcreate count, shows how many entities were either updated or created. XORd by a shuffled integer in memory
  01 03 // 2 varuints, which represent the hash and entity id (<1, 3> in this case). this is an entity either updated or created.
    00 // a u8 value which represents whether or not the entity was updated or created. 0 represents update, 1 represents deletion
    01 // signifies the start of the "jump table", which has all of the data of the entity
      00 // a jump in the table
      02 08 // random field value data, parsed by detecting field group. too complicated to explain how field group and etc is calculated
      00 // a jump in the table
      02 09  // random field value data
    01 // signifies end of jump table
  01 11 // 2 varuints and yadaydayda, the entity id.
    08 03 01 // signifies creation, as the last vu is 01. the predecessing elements are jump table values. creations are processed differently. you use the field groups provided here to parse the field data below
    01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 08 11 43 79 102 93 01 // random field group data parsed by the field groups porvided above. always ends with 01
```
### **0x01: The `Invalid Build` Packet**
This packet tells the client that they are not using the correct build. In Diep.io, there is a build system which is used to ensure synchronization between the client and server. If this packet is sent, the webpage will reload. If the server is updated, then the client should also be updated to accomodate the new shuffling XORs and packet shuffling seeds.

Format: `[vu(header(0x01)), string(build)]`

### **0x02: The `Compressed` Packet**
If a packet is too big (exceeds the maximum length of a buffer, as of `10/15/2022` it is `65536` bytes), it is compressed into LZ4 blocks. Read more about LZ4 [here](https://en.wikipedia.org/wiki/LZ4_(compression_algorithm). A good module in Node.js to use is `node-lz4`, which can compress and decompress using the LZ4 algorithm.

Format: 
### **0x03: The `Notification` Packet**
This packet tells the client to render a notification (e.g. `You've killed x`, `The boss has been defeated by x!`)

Format

### **0x04: 
