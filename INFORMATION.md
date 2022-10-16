# Diep.io Parser

You may find a copy of my Diep.io parser [here](https://github.com/Altanis/lb-bot/blob/main/new_lb_bot/WebSocket/connection/helpers/parser.js) in JavaScript. This parser can parse any incoming clients, and generate any outgoing packets. This document will detail how packet structure works in verbatum.

This document may detail **everything** that I know of, including shuffling, 

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

Format: `[vu(header(0x02)), i32(lz4 block count), lz4blocks]`

### **0x02: The `Compressed` Packet**
If a packet is too big (exceeds the maximum length of a buffer, as of `10/15/2022` it is `65536` bytes), it is compressed into LZ4 blocks. Read more about LZ4 [here](https://en.wikipedia.org/wiki/LZ4_(compression_algorithm)). A good module in Node.js to use is `node-lz4`, which can compress and decompress using the LZ4 algorithm.

Format: 
### **0x03: The `Notification` Packet**
This packet tells the client to render a notification (e.g. `You've killed x`, `The boss has been defeated by x!`)

Format: `[vu(header(0x03)), string(message), u32(BGR), f32(duration), string?(identifier)]`

### **0x04: The `Lobby Information` Packet**
This packet tells the client what gamemode, host (provider such as vultr), and region the lobby is. The host and region is used to display ping (e.g. `33ms vultr-miami`)

Format: `[vu(header(0x04)), string(gamemode), string(lobbyID), string(host-region)]`

### **0x05: The `Ping` Packet**
This packet is sent in response to the serverbound ping packet. This packet is used to calculate the ping, by subtracting the timestamp from when the serverbound ping packet is sent to when the clientbound ping packet is received.

Format: `[vu(header(0x05))]`

### **0x06: The `Party` Packet**
This packet is sent if the client has connected to a 2TDM, 4TDM, or Sandbox server. The bytes after the header are appended to the lobby's id (encoded as a string). After that, swap the nibbles in every byte.

Example:
```
clientbound <- header(06) bytes(2D CD 03 54 C3)
stringNT("742a37-f24a-4030-b4bd-2fa3515965af") + ...bytes
37 34 32 61 33 37 2D 66 32 34 61 2D 34 30 33 30 2D 62 34 62 64 2D 32 66 61 33 35 31 35 39 36 35 61 66 2D CD 03 54 C3
// reverse nibbles
73 43 23 16 33 73 D2 66 23 43 16 D2 43 03 33 03 D2 26 43 26 46 D2 23 66 16 33 53 13 53 93 63 53 16 66 D2 DC 30 45 3C
// resulting link: https://diep.io/#734323163373D266234316D243033303D226432646D2236616335313539363531666D2DC30453C
```

Format: `[vu(header(0x06)), bytes(party)]`

### **0x07: The `Accept` Packet**
This packet is sent when the client is accepted into the server after passing anticheat checks ([`PoW Challenge`]() and [`JS Challenge`]() packets).

Format: `[vu(header(0x07))]`

### **0x08: The `Achievements` Packet**
This packet tells the client when they've unlocked an achievement. Each achievement has a hash, which can be located at `localStorage["A::" + hash]`.

Format: `[vu(header(0x08)), i8(achievement count), ...array(achievement hashes))`

### **0x09: The `Invalid Party` Packet**
This packet tells the client the party they tried to join is invalid, full, or expired. The client will alert "Invalid party ID", then automatically locate a new server.

Format: `[vu(header(0x09))]`

### **0x0a: The `Player Count` Packet**
**AS OF WHEN RIVET HAS MODIFIED DIEP, THIS HAS NO LONGER BEEN USED IN PRODUCTION AND THE CLIENT NO LONGER TAKES THIS PACKET INTO ACCOUNT.**

This packet tells the client the amount of players that are currently connected to the game. It is rendered below the "diep.io" text, and above the latency and minimap. For around a month each year (before it was removed from production), there would be a bug where the player count would be steadily decreasing for nearly a month. Around Day 15, the player count would be 0 and not be rectified until the month after. These bugs fixed themselves, not by Zeach.

Format: `[vu(header(0x0a)), vu(player count)]`

### **0x0b: The `PoW Challenge Packet`**
This packet was added in June 2020 as a response to frequent bottings done by [Shädam](https://github.com/supahero1), which have been documented on YouTube. He (and Innocent, a friend of his) would spawn lagbots (bots which lagged the server due to the sheer amount of compressions it had to do, as ~200 bots would spawn and shoot) and pushbots (bots which would follow inputs, which allowed ~200 baby tanks to push a tank in an attempt to get them killed).

This packet gives the client a string and a numerical difficulty, and is sent when connecting, when attempting to spawn, and every 15-20 seconds. The client must compute a hash, which would be difficult to do as a human but easy as a computer, using the string and difficulty (and in Diep.io's specific case, using a SHA1 hashing algorithm). If this hash is incorrect, then the WebSocket connection is closed. This forces the client to do some work, so joining ~200 bots would make the client do heavy amounts of work, which would be unfeasible.

There is also a "time bank" for how long it can take for you to solve a PoW. Unfourtanetly, I forgot the specifics, but there is an alloted time for you to solve the proof of work for lower end PCs. However, due to the CPU cost, people started lagging. This is assumed to be the reason of the player counting dropping from 5000 players to ~2500 players.

Format: `[vu(header(0x0b)), i8(difficulty), string(prefix/string)]`

### **0x0c: The `JS String Challenge` Packet**
This packet has never been observed in production, and was only reversed via reading the WASM. This packet was identical to the `JS Challenge` packet being used in production today.

Format: `[vu(header(0x0c)), vu(??)]`

### **0x0d: The `JS Challenge` Packet**
This packet was added in November 2020 as a response to botting. This packet is sent to the client once, during the handshake before connection. The packet contains obfuscated JS code for the client to evaluate in a function scope, and an ID for the server to identify which packet the client was responding to. The code has properties designed to detect if the environment its evaluated in is not on a standard Diep.io client (such as checking `navigator` or `globalThis` or other globals). 

If the packet is run in a proper environment, inside an IIFE as so: `new Function(obfuscatedCode)(result => {});`. `result` would be an integer which would be encoded as an unsigned 32-bit integer. This result is then returned back to the server, along with the ID sent by the server. If the result is incorrect, the WebSocket connection closes.

Format: `[vu(header(0x0d)), vu(i8), string(code)]`
