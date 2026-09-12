import {
  Book,
  ConceptMastery,
  Flashcard,
  QuizQuestion,
  StudentProgress,
  VideoLecture,
} from "@/types";

export const DEMO_BOOK: Book = {
  id: "book-net-101",
  title: "Computer Networking: Principles & Protocols",
  author: "Dr. James F. Kurose & Keith W. Ross",
  edition: "8th Edition (University Academic Edition)",
  subject: "Computer Science - Computer Networks",
  totalPages: 76,
  coverImage: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
  chapters: [
    {
      id: "ch-1",
      number: 1,
      title: "Computer Networks and the Internet",
      startPage: 1,
      endPage: 28,
      sections: [
        { id: "sec-1-1", number: "1.1", title: "What is the Internet?", page: 1 },
        { id: "sec-1-2", number: "1.2", title: "The Network Edge and Core", page: 12 },
        { id: "sec-1-3", number: "1.3", title: "Delay, Loss, and Throughput in Packet-Switched Networks", page: 20 },
      ],
    },
    {
      id: "ch-2",
      number: 2,
      title: "Application Layer",
      startPage: 29,
      endPage: 69,
      sections: [
        { id: "sec-2-1", number: "2.1", title: "Principles of Network Applications", page: 29 },
        { id: "sec-2-2", number: "2.2", title: "The Web and HTTP/2", page: 38 },
        { id: "sec-2-3", number: "2.3", title: "DNS: The Internet's Directory Service", page: 54 },
      ],
    },
    {
      id: "ch-3",
      number: 3,
      title: "Transport Layer",
      startPage: 70,
      endPage: 76,
      sections: [
        { id: "sec-3-1", number: "3.1", title: "Transport-Layer Services & Multiplexing", page: 70 },
        { id: "sec-3-2", number: "3.2", title: "Principles of Reliable Data Transfer", page: 71 },
        { id: "sec-3-3", number: "3.3", title: "TCP Three-Way Handshake & Connection Management", page: 72 },
        { id: "sec-3-4", number: "3.4", title: "TCP Flow Control & The Sliding Window", page: 73 },
        { id: "sec-3-5", number: "3.5", title: "TCP Congestion Control & AIMD Algorithm", page: 74 },
        { id: "sec-3-6", number: "3.6", title: "UDP Protocol vs TCP Trade-offs", page: 75 },
        { id: "sec-3-7", number: "3.7", title: "IPv4 Addressing & Subnetting Mechanics", page: 76 },
      ],
    },
  ],
  pages: [
    {
      pageNumber: 70,
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-1",
      sectionTitle: "3.1 Transport-Layer Services & Multiplexing",
      title: "3.1 Transport-Layer Services & Multiplexing",
      content: `## 3.1 Transport-Layer Services and Multiplexing

A transport-layer protocol provides for **logical communication** between application processes running on different hosts. Logical communication means that from an application’s perspective, it is as if the hosts running the processes were directly connected.

\`\`\`text
[ Application Layer ]  →  Messages (HTTP, DNS)
         │
[ Transport Layer ]    →  Segments (TCP / UDP)  ← (Logical Host-to-Host)
         │
[ Network Layer ]      →  Datagrams (IP)        ← (Physical Host-to-Host Routing)
         │
[ Link Layer ]         →  Frames (Ethernet, Wi-Fi)
\`\`\`

### Multiplexing and Demultiplexing

* **Demultiplexing:** Delivering data in a transport-layer segment to the correct socket based on the destination port number and IP address.
* **Multiplexing:** Gathering data chunks at the source host from different sockets, encapsulating each data chunk with transport headers (including port numbers) to create segments, and passing the segments to the network layer.

### Port Numbers
A port number is a 16-bit number ranging from **0 to 65535**:
1. **Well-known ports (0–1023):** e.g., HTTP (80), HTTPS (443), SSH (22), DNS (53).
2. **Registered / Ephemeral ports (1024–65535):** dynamically assigned by the client OS.

A TCP socket is identified by a **4-tuple**:
$$\\text{Socket Identifier} = (\\text{Source IP}, \\text{Source Port}, \\text{Destination IP}, \\text{Destination Port})$$`,
      keyTakeaways: [
        "Transport layer provides logical host-to-host process communication.",
        "Multiplexing bundles data from sockets; demultiplexing routes incoming segments to correct sockets via 4-tuple matching.",
        "Port numbers range from 0 to 65535 (16-bit field).",
      ],
      equations: ["\\text{TCP 4-tuple} = (\\text{SrcIP}, \\text{SrcPort}, \\text{DstIP}, \\text{DstPort})"],
    },
    {
      pageNumber: 71,
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-2",
      sectionTitle: "3.2 Principles of Reliable Data Transfer",
      title: "3.2 Principles of Reliable Data Transfer (rdt)",
      content: `## 3.2 Principles of Reliable Data Transfer

The problem of positively delivering data reliably over an unreliable underlying physical channel (the IP layer) is one of the foundational challenges in computer networking.

### The rdt Protocol Evolution

1. **rdt 1.0 (Completely Reliable Channel):** No bit errors, no packet loss. Sender simply sends; receiver simply receives.
2. **rdt 2.0 (Channel with Bit Errors):** Introduces **Checksums**, **ACKs (Positive Acknowledgments)**, and **NAKs (Negative Acknowledgments)**.
   * *The fatal flaw in rdt 2.0:* What if the ACK/NAK itself gets corrupted?
3. **rdt 2.1 (Handling Corrupted ACKs):** Adds **Sequence Numbers** (0 or 1 for Stop-and-Wait). If the sender receives a garbled ACK, it retransmits; the receiver knows whether the packet is a duplicate based on the sequence bit.
4. **rdt 3.0 (Channel with Errors and Loss):** Introduces **Countdown Timers**. If an ACK is not received within the timeout interval RTO, the packet is retransmitted.

### Stop-and-Wait vs Pipelined Protocols
Stop-and-Wait suffers from poor channel utilization:
$$U_{\\text{sender}} = \\frac{L / R}{RTT + L / R}$$

To overcome this, modern protocols use **Pipelining** (e.g., Go-Back-N and Selective Repeat), allowing multiple packets to be in flight simultaneously up to a window size $N$.`,
      keyTakeaways: [
        "Sequence numbers solve the problem of duplicate packets when ACKs are lost or delayed.",
        "Timers detect packet loss over lossy IP networks.",
        "Pipelining (Go-Back-N and Selective Repeat) drastically improves link utilization compared to Stop-and-Wait.",
      ],
      equations: ["U_{\\text{sender}} = \\frac{L / R}{RTT + L / R}"],
    },
    {
      pageNumber: 72,
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-3",
      sectionTitle: "3.3 TCP Three-Way Handshake & Connection Management",
      title: "3.3 TCP Three-Way Handshake & Connection Management",
      content: `## 3.3 TCP Three-Way Handshake

Before a client and server can exchange payload data using TCP, they must establish a connection through the **Three-Way Handshake**. This process synchronizes sequence numbers, agrees upon Initial Sequence Numbers (ISN), and sets up buffer allocations and MSS (Maximum Segment Size).

\`\`\`text
CLIENT (Initiator)                                SERVER (Listener)
  [ CLOSED ]                                          [ LISTEN ]
      │                                                   │
      │  Step 1: SYN (seq = client_isn)                   │
      ├──────────────────────────────────────────────────►│  [ SYN_RCVD ]
      │                                                   │
      │  Step 2: SYN-ACK (seq = server_isn, ack = client_isn + 1)
      │◄──────────────────────────────────────────────────┤
[ ESTABLISHED ]                                           │
      │                                                   │
      │  Step 3: ACK (seq = client_isn + 1, ack = server_isn + 1)
      ├──────────────────────────────────────────────────►│
      │   (Payload data can also be sent in Step 3)       │
      │                                             [ ESTABLISHED ]
\`\`\`

### Why Three Messages Instead of Two?

A fundamental question is: *Why can't TCP establish a connection in two messages?*

1. **Two-Way Handshake Vulnerability to Delayed Duplicates:**
   Suppose a client sends a connection request SYN_1, but network congestion delays it. The client times out, sends SYN_2, communicates, and closes. Later, the delayed SYN_1 arrives at the server. If only two messages were required, the server would send an ACK and immediately enter \`ESTABLISHED\`, allocating memory and waiting for data that the client has no intention of sending (creating **half-open phantom connections**).
2. **Mutual Sequence Number Synchronization:**
   Both sides must independently choose a random Initial Sequence Number (ISN) and receive unambiguous confirmation that the counterparty has registered their specific ISN. The third message allows the client to acknowledge receipt of the server's sequence number.

### TCP Connection Teardown (Four-Way Handshake)
Connection teardown requires **4 steps** because TCP is full-duplex (each direction closes independently):
1. **Client to Server:** \`FIN\` (Client indicates it is done sending data).
2. **Server to Client:** \`ACK\` (Server acknowledges client close; server can still send data).
3. **Server to Client:** \`FIN\` (Server finishes sending and initiates close).
4. **Client to Server:** \`ACK\` (Client acknowledges; enters \`TIME_WAIT\` for 2 * MSL).`,
      keyTakeaways: [
        "TCP Three-Way Handshake: SYN -> SYN-ACK -> ACK.",
        "Three messages are necessary to prevent old duplicate connection requests from creating phantom half-open connections on the server.",
        "Both endpoints securely synchronize their independent Initial Sequence Numbers (ISN).",
        "Connection teardown uses 4 packets (FIN -> ACK -> FIN -> ACK) to handle independent duplex closure with TIME_WAIT.",
      ],
      equations: [
        "\\text{Client Step 1: } SYN, \\; seq = x",
        "\\text{Server Step 2: } SYN\\text{-}ACK, \\; seq = y, \\; ack = x + 1",
        "\\text{Client Step 3: } ACK, \\; seq = x + 1, \\; ack = y + 1",
      ],
    },
    {
      pageNumber: 73,
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-4",
      sectionTitle: "3.4 TCP Flow Control & The Sliding Window",
      title: "3.4 TCP Flow Control & The Sliding Window",
      content: `## 3.4 TCP Flow Control & The Sliding Window

TCP provides a **flow-control service** to eliminate the possibility of the sender overflowing the receiver's buffer. Flow control is a speed-matching service matching the rate at which the sender is sending against the rate at which the receiving application is reading.

### The Receive Window (rwnd)
The receiver allocates a buffer \`RcvBuffer\` for the connection. The receiver keeps track of:
* \`LastByteRead\`: the number of the last byte of data read from the buffer by the application.
* \`LastByteRcvd\`: the number of the last byte of data that has arrived from the network.

To prevent buffer overflow, TCP enforces:
$$\\text{LastByteRcvd} - \\text{LastByteRead} \\le \\text{RcvBuffer}$$

The receive window $rwnd$ represents the spare room in the buffer:
$$rwnd = \\text{RcvBuffer} - [\\text{LastByteRcvd} - \\text{LastByteRead}]$$

\`\`\`text
Receiver Buffer:
┌──────────────────────────────────────┬──────────────────────┐
│ Buffered & unread bytes              │  Spare Room (rwnd)   │
└──────────────────────────────────────┴──────────────────────┘
◄─────────────── RcvBuffer ───────────────────────────────────►
\`\`\`

### Sender Invariant
The sender guarantees that the amount of unacknowledged data in flight never exceeds $rwnd$:
$$\\text{LastByteSent} - \\text{LastByteAcked} \\le rwnd$$

### The Zero-Window Deadlock & Persistence Timer
If the receiver advertises $rwnd = 0$, the sender stops transmitting. When the receiver's application later reads data, it sends an update with $rwnd > 0$. If this update packet gets lost, both sides could wait forever.

To prevent this deadlock, TCP uses a **Persistence Timer**: the sender periodically sends a **1-byte probe segment** to force the receiver to respond with its current $rwnd$.`,
      keyTakeaways: [
        "Flow control prevents a fast sender from overflowing a slow receiver's buffer.",
        "The receiver includes the available buffer space in the 16-bit Receive Window (rwnd) header field.",
        "A persistence timer sends 1-byte probes to avoid deadlock when rwnd drops to 0.",
      ],
      equations: [
        "rwnd = \\text{RcvBuffer} - (\\text{LastByteRcvd} - \\text{LastByteRead})",
        "\\text{LastByteSent} - \\text{LastByteAcked} \\le rwnd",
      ],
    },
    {
      pageNumber: 74,
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-5",
      sectionTitle: "3.5 TCP Congestion Control & AIMD Algorithm",
      title: "3.5 TCP Congestion Control & AIMD Algorithm",
      content: `## 3.5 TCP Congestion Control & AIMD Algorithm

While flow control protects the receiver, **congestion control** protects the shared network links and intermediate routers from being overloaded by packet storms.

### Congestion Window (cwnd)
TCP sender maintains a state variable $cwnd$ (Congestion Window). The amount of unacknowledged in-flight data is bounded by:
$$\\text{InFlight} \\le \\min(cwnd, rwnd)$$

### Additive Increase / Multiplicative Decrease (AIMD)
TCP probes for bandwidth by adjusting $cwnd$:
1. **Additive Increase:** Increase $cwnd$ by **1 MSS** (Maximum Segment Size) every Round Trip Time ($RTT$) until loss occurs:
   $$cwnd = cwnd + 1\\text{ MSS per RTT}$$
2. **Multiplicative Decrease:** Cut $cwnd$ in **half** upon detecting packet loss via triple duplicate ACKs:
   $$cwnd_{\\text{new}} = \\frac{cwnd_{\\text{old}}}{2}$$

\`\`\`text
cwnd (MSS)
  ▲          /\\          /\\          /\\     (Sawtooth Behavior)
32│         /  \\        /  \\        /  \\
  │        /    \\      /    \\      /    \\
16│  /\\   /      \\    /      \\    /      \\
 8│ /  \\ /        \\  /        \\  /        \\
 0└─┴───┴──────────┴──────────┴────────────► Time
\`\`\`

### TCP Congestion Control Phases

1. **Slow Start:** $cwnd$ starts at 1 MSS and doubles every RTT ($1 \\to 2 \\to 4 \\to 8 \\dots$) exponentially until reaching \`ssthresh\` (Slow Start Threshold).
2. **Congestion Avoidance:** When $cwnd \\ge ssthresh$, linear additive increase begins ($+1\\text{ MSS}$ per RTT).
3. **Fast Recovery:** On 3 duplicate ACKs (indicating packet loss, but network still delivering packets), \`ssthresh\` is set to $cwnd/2$, $cwnd$ is set to $\\text{ssthresh} + 3\\text{ MSS}$, and linear growth resumes. On Timeout, $cwnd$ drops to 1 MSS.`,
      keyTakeaways: [
        "Congestion control prevents overloading intermediate router buffers across the Internet.",
        "AIMD produces the famous TCP Sawtooth curve (Additive Increase, Multiplicative Decrease).",
        "Slow start grows cwnd exponentially up to ssthresh; Congestion Avoidance grows cwnd linearly.",
      ],
      equations: [
        "\\text{Additive Increase: } cwnd \\leftarrow cwnd + \\text{MSS} \\quad (\\text{per RTT})",
        "\\text{Multiplicative Decrease: } cwnd \\leftarrow \\frac{cwnd}{2} \\quad (\\text{on 3 dup ACKs})",
      ],
    },
    {
      pageNumber: 75,
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-6",
      sectionTitle: "3.6 UDP Protocol vs TCP Trade-offs",
      title: "3.6 UDP Protocol vs TCP Trade-offs",
      content: `## 3.6 UDP Protocol vs TCP Trade-offs

User Datagram Protocol (UDP, RFC 768) is a minimalist, no-frills transport protocol. It provides almost no services beyond multiplexing/demultiplexing and basic checksum error checking.

### Comparison Table: TCP vs UDP

| Feature | TCP (Transmission Control Protocol) | UDP (User Datagram Protocol) |
| :--- | :--- | :--- |
| **Connection State** | Connection-oriented (3-way handshake) | Connectionless (no handshake delay) |
| **Reliability** | Guaranteed in-order delivery, ACKs, retransmissions | Best-effort; packets can be lost, reordered, duplicated |
| **Header Overhead** | 20–60 bytes per packet | 8 bytes per packet |
| **Flow & Congestion Control** | Yes ($rwnd$, $cwnd$, AIMD throttling) | None; application sends at full line rate |
| **Use Cases** | Web (HTTP/HTTPS), File Transfer (FTP), Email (SMTP), SSH | DNS queries, Live Video Streaming, VoIP, Online Gaming, QUIC |

### UDP Header Structure (8 Bytes Total)
\`\`\`text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Source Port          |       Destination Port        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|            Length             |           Checksum            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
\`\`\`

### Why Do Real-Time Applications Choose UDP?
1. **Finer Application-Level Control:** Real-time video/voice can tolerate slight loss but cannot tolerate the arbitrary latency of TCP retransmissions and Head-of-Line blocking.
2. **Zero Handshake Delay:** DNS lookups resolve in 1 RTT instead of 2 RTTs.
3. **Low Header Overhead:** 8-byte header saves bandwidth over small packet payloads.`,
      keyTakeaways: [
        "UDP is lightweight, connectionless, and has only an 8-byte header.",
        "UDP does not throttle send rates or perform retransmissions, making it ideal for DNS, gaming, and real-time audio/video.",
        "QUIC (HTTP/3) builds reliable streams over UDP in user space to avoid kernel head-of-line blocking.",
      ],
      equations: ["\\text{UDP Header Size} = 8\\text{ Bytes}"],
    },
    {
      pageNumber: 76,
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-7",
      sectionTitle: "3.7 IPv4 Addressing & Subnetting Mechanics",
      title: "3.7 IPv4 Addressing & Subnetting Mechanics",
      content: `## 3.7 IPv4 Addressing & Subnetting Mechanics

An IPv4 address is a **32-bit binary number**, typically written in dotted-decimal format (e.g., \`192.168.1.1\`).

### Classless Inter-Domain Routing (CIDR)
In CIDR notation ($a.b.c.d/x$), the $/x$ indicates that the first $x$ bits are the **Network Prefix** (Subnet ID), and the remaining $(32 - x)$ bits represent individual **Host IDs**.

$$\\text{Total Host Addresses Available} = 2^{32 - x} - 2$$
*(We subtract 2 because the all-zero host address is reserved for the **Network Address**, and the all-ones host address is reserved for the **Broadcast Address**).*

### Subnetting Example: \`192.168.10.0/26\`
* **Prefix Length:** 26 bits
* **Host bits:** $32 - 26 = 6$ bits
* **Subnet Mask:** \`255.255.255.192\` ($11111111.11111111.11111111.11000000_2$)
* **Total usable hosts:** $2^6 - 2 = 64 - 2 = 62$ hosts.

\`\`\`text
Subnet Blocks for 192.168.10.0/26:
├─ Subnet 1: 192.168.10.0   - 192.168.10.63   (Usable: .1  to .62)
├─ Subnet 2: 192.168.10.64  - 192.168.10.127  (Usable: .65 to .126)
├─ Subnet 3: 192.168.10.128 - 192.168.10.191  (Usable: .129 to .190)
└─ Subnet 4: 192.168.10.192 - 192.168.10.255  (Usable: .193 to .254)
\`\`\`

### Common Subnetting Pitfalls
* Confusing prefix length $/24$ (254 hosts) with $/28$ (14 hosts).
* Forgetting to subtract the Network and Broadcast addresses when sizing a subnet for $k$ machines.`,
      keyTakeaways: [
        "CIDR notation specifies network bits /x, leaving (32-x) bits for host assignments.",
        "Total usable hosts per subnet is 2^(32-x) - 2.",
        "Network ID is host bits all 0; Broadcast ID is host bits all 1.",
      ],
      equations: ["\\text{Usable Hosts} = 2^{32 - x} - 2"],
    },
  ],
  chunks: [
    {
      id: "chunk-70-1",
      bookId: "book-net-101",
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-1",
      sectionTitle: "3.1 Transport-Layer Services & Multiplexing",
      pageNumber: 70,
      text: "A transport-layer protocol provides logical communication between application processes running on different hosts. Multiplexing gathers data from sockets, adds headers, and sends to network layer. Demultiplexing uses the 4-tuple (source IP, source port, dest IP, dest port) to route incoming segments to the exact application socket.",
      keyTerms: ["logical communication", "multiplexing", "demultiplexing", "4-tuple", "port numbers"],
    },
    {
      id: "chunk-71-1",
      bookId: "book-net-101",
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-2",
      sectionTitle: "3.2 Principles of Reliable Data Transfer",
      pageNumber: 71,
      text: "Reliable data transfer (rdt) protocols evolve through rdt 1.0, 2.0, 2.1, and 3.0. Key mechanisms include Checksums for bit errors, Sequence Numbers for duplicate detection, ACKs for positive feedback, and Timers for packet loss recovery. Pipelined protocols (Go-Back-N, Selective Repeat) dramatically improve utilization over Stop-and-Wait.",
      keyTerms: ["rdt", "checksum", "sequence numbers", "ACK", "countdown timer", "pipelining", "Go-Back-N"],
    },
    {
      id: "chunk-72-1",
      bookId: "book-net-101",
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-3",
      sectionTitle: "3.3 TCP Three-Way Handshake & Connection Management",
      pageNumber: 72,
      text: "TCP uses a three-way handshake (SYN, SYN-ACK, ACK) to establish a connection. Three messages are required because a two-way handshake is vulnerable to old duplicate SYN packets causing half-open phantom connections on the server. Furthermore, both client and server must independently synchronize their Initial Sequence Numbers (ISNs). Teardown uses a 4-way handshake (FIN, ACK, FIN, ACK) with a 2*MSL TIME_WAIT state.",
      keyTerms: ["three-way handshake", "SYN", "SYN-ACK", "ACK", "Initial Sequence Number", "ISN", "phantom connection", "FIN", "TIME_WAIT"],
    },
    {
      id: "chunk-73-1",
      bookId: "book-net-101",
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-4",
      sectionTitle: "3.4 TCP Flow Control & The Sliding Window",
      pageNumber: 73,
      text: "TCP Flow Control matches the sender's transmission rate to the receiver's application read rate. The receiver advertises its available buffer space via the receive window (rwnd) field. The sender ensures unacknowledged bytes (LastByteSent - LastByteAcked) never exceed rwnd. When rwnd is 0, the sender starts a persistence timer and periodically transmits 1-byte probe segments to prevent deadlock.",
      keyTerms: ["flow control", "receive window", "rwnd", "RcvBuffer", "persistence timer", "1-byte probe"],
    },
    {
      id: "chunk-74-1",
      bookId: "book-net-101",
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-5",
      sectionTitle: "3.5 TCP Congestion Control & AIMD Algorithm",
      pageNumber: 74,
      text: "TCP Congestion Control prevents overwhelming router queues in the network core. In-flight data is limited by min(cwnd, rwnd). TCP utilizes Additive Increase Multiplicative Decrease (AIMD): cwnd increases by 1 MSS per RTT in congestion avoidance, and drops by half upon receiving 3 duplicate ACKs. Phases include Slow Start (exponential growth to ssthresh), Congestion Avoidance (linear growth), and Fast Recovery.",
      keyTerms: ["congestion control", "cwnd", "AIMD", "additive increase", "multiplicative decrease", "slow start", "ssthresh", "fast recovery"],
    },
    {
      id: "chunk-75-1",
      bookId: "book-net-101",
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-6",
      sectionTitle: "3.6 UDP Protocol vs TCP Trade-offs",
      pageNumber: 75,
      text: "UDP is a lightweight, connectionless transport protocol with an 8-byte header and zero handshake delay. Unlike TCP, UDP does not provide reliability, sequence ordering, flow control, or congestion control. UDP is preferred by real-time voice, video streaming, DNS, and online gaming where speed is critical and slight packet loss is tolerable.",
      keyTerms: ["UDP", "connectionless", "8-byte header", "no handshake", "DNS", "real-time streaming", "HTTP/3 QUIC"],
    },
    {
      id: "chunk-76-1",
      bookId: "book-net-101",
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-7",
      sectionTitle: "3.7 IPv4 Addressing & Subnetting Mechanics",
      pageNumber: 76,
      text: "IPv4 addresses are 32-bit values written in CIDR format (a.b.c.d/x). The /x prefix defines the network portion, while (32 - x) bits define the host ID. The usable host capacity is 2^(32-x) - 2, subtracting the Network Address (all host bits 0) and Broadcast Address (all host bits 1).",
      keyTerms: ["IPv4", "CIDR", "subnet mask", "usable hosts", "network address", "broadcast address", "prefix length"],
    },
  ],
};

export const DEMO_VIDEO: VideoLecture = {
  id: "video-tcp-101",
  title: "TCP Connection Establishment & The 3-Way Handshake Explained",
  youtubeId: "k9ZGsUR58SE",
  channelName: "Stanford Online / Networking Fundamentals",
  durationSeconds: 780,
  formattedDuration: "13:00",
  bookId: "book-net-101",
  topics: [
    {
      timestampSeconds: 0,
      formattedTime: "00:00",
      title: "Lecture Intro & Transport Layer Foundations",
      chapterId: "ch-3",
      pageNumber: 70,
      summary: "Overview of end-to-end transport communication and port multiplexing.",
    },
    {
      timestampSeconds: 120,
      formattedTime: "02:00",
      title: "Why Connectionless Isn't Enough: Reliable Transfer",
      chapterId: "ch-3",
      pageNumber: 71,
      summary: "Analysis of packet loss, duplicates, and sequence number mechanics.",
    },
    {
      timestampSeconds: 240,
      formattedTime: "04:00",
      title: "The TCP Three-Way Handshake Deep Dive",
      chapterId: "ch-3",
      pageNumber: 72,
      summary: "Step-by-step SYN, SYN-ACK, ACK packet exchange and ISN negotiation.",
    },
    {
      timestampSeconds: 435,
      formattedTime: "07:15",
      title: "Why Two Messages Fail: Phantom Connections",
      chapterId: "ch-3",
      pageNumber: 72,
      summary: "Proof of why a 2-way handshake fails when delayed duplicate SYNs arrive.",
    },
    {
      timestampSeconds: 570,
      formattedTime: "09:30",
      title: "Sliding Window Flow Control & rwnd",
      chapterId: "ch-3",
      pageNumber: 73,
      summary: "Receiver buffer management, rwnd advertising, and zero-window probe timers.",
    },
    {
      timestampSeconds: 690,
      formattedTime: "11:30",
      title: "Congestion Control & AIMD Sawtooth",
      chapterId: "ch-3",
      pageNumber: 74,
      summary: "Difference between flow control and network core congestion control.",
    },
  ],
};

export const DEMO_CONCEPTS: ConceptMastery[] = [
  {
    id: "concept-tcp",
    name: "TCP Three-Way Handshake",
    category: "Transport Layer",
    masteryPercentage: 90,
    questionsAttempted: 20,
    questionsCorrect: 18,
    isWeak: false,
    recommendedChapter: "Chapter 3: Transport Layer",
    recommendedPage: 72,
  },
  {
    id: "concept-udp",
    name: "UDP vs TCP Protocols",
    category: "Transport Layer",
    masteryPercentage: 80,
    questionsAttempted: 15,
    questionsCorrect: 12,
    isWeak: false,
    recommendedChapter: "Chapter 3: Transport Layer",
    recommendedPage: 75,
  },
  {
    id: "concept-routing",
    name: "IP Routing & Multiplexing",
    category: "Network Layer",
    masteryPercentage: 60,
    questionsAttempted: 10,
    questionsCorrect: 6,
    isWeak: false,
    recommendedChapter: "Chapter 3: Transport Layer",
    recommendedPage: 70,
  },
  {
    id: "concept-subnetting",
    name: "CIDR Subnetting Calculations",
    category: "Addressing",
    masteryPercentage: 40,
    questionsAttempted: 12,
    questionsCorrect: 5,
    isWeak: true,
    recommendedChapter: "Chapter 3: Transport Layer",
    recommendedPage: 76,
  },
];

export const DEMO_FLASHCARDS: Flashcard[] = [
  {
    id: "fc-1",
    bookId: "book-net-101",
    chapterId: "ch-3",
    pageNumber: 72,
    concept: "TCP Three-Way Handshake",
    question: "Why can't TCP establish a reliable connection with only 2 messages instead of 3?",
    answer:
      "A 2-way handshake cannot handle delayed duplicate SYN packets in the network. If an old duplicate SYN arrives at the server, the server would open a phantom half-open connection without knowing the client no longer wants to connect. The 3rd message confirms both sides have synchronized their Initial Sequence Numbers (ISNs).",
    status: "mastered",
    lastReviewed: "Yesterday",
  },
  {
    id: "fc-2",
    bookId: "book-net-101",
    chapterId: "ch-3",
    pageNumber: 73,
    concept: "TCP Flow Control",
    question: "How does TCP prevent a fast sender from overflowing a slow receiver's buffer?",
    answer:
      "The receiver continuously advertises its available buffer space in the 16-bit 'rwnd' (Receive Window) header field. The sender bounds unacknowledged in-flight bytes: (LastByteSent - LastByteAcked) <= rwnd.",
    status: "learning",
    lastReviewed: "2 hours ago",
  },
  {
    id: "fc-3",
    bookId: "book-net-101",
    chapterId: "ch-3",
    pageNumber: 74,
    concept: "TCP Congestion Control (AIMD)",
    question: "What does AIMD stand for and how does it adjust the congestion window (cwnd)?",
    answer:
      "Additive Increase / Multiplicative Decrease. In congestion avoidance, cwnd increases linearly by +1 MSS per RTT upon successful packet delivery, and halves (cwnd / 2) when packet loss is detected via 3 duplicate ACKs.",
    status: "learning",
    lastReviewed: "Today",
  },
  {
    id: "fc-4",
    bookId: "book-net-101",
    chapterId: "ch-3",
    pageNumber: 76,
    concept: "IPv4 Subnetting",
    question: "How many usable host IP addresses are available in a /28 subnet?",
    answer:
      "A /28 subnet has 32 - 28 = 4 host bits. Total addresses = 2^4 = 16. Usable addresses = 16 - 2 = 14 (subtracting Network ID and Broadcast ID).",
    status: "unseen",
  },
];

export const DEMO_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "quiz-q1",
    bookId: "book-net-101",
    chapterId: "ch-3",
    pageNumber: 72,
    concept: "TCP Three-Way Handshake",
    question: "During step 2 of the TCP 3-way handshake, what sequence and acknowledgment numbers does the server send in response to a client's SYN packet with seq = 1000?",
    options: [
      { id: "opt-1", text: "seq = 1001, ack = 1001", isCorrect: false },
      { id: "opt-2", text: "seq = server_isn, ack = 1001", isCorrect: true },
      { id: "opt-3", text: "seq = 1000, ack = server_isn + 1", isCorrect: false },
      { id: "opt-4", text: "seq = server_isn, ack = 1000", isCorrect: false },
    ],
    explanation:
      "The server generates its own random Initial Sequence Number (server_isn) and acknowledges the client's SYN (which consumed sequence number 1000) by setting ack = 1000 + 1 = 1001.",
    difficulty: "medium",
  },
  {
    id: "quiz-q2",
    bookId: "book-net-101",
    chapterId: "ch-3",
    pageNumber: 73,
    concept: "TCP Flow Control",
    question: "What mechanism does TCP use to prevent deadlock if a receiver's window update packet (rwnd > 0) is lost?",
    options: [
      { id: "opt-1", text: "The receiver sends an immediate RST packet", isCorrect: false },
      { id: "opt-2", text: "The sender transmits 1-byte probe segments using a persistence timer", isCorrect: true },
      { id: "opt-3", text: "The connection automatically drops and renegotiates", isCorrect: false },
      { id: "opt-4", text: "The sender switches to UDP mode", isCorrect: false },
    ],
    explanation:
      "When rwnd = 0, the sender's persistence timer periodically triggers a 1-byte probe segment. The receiver must acknowledge this probe with its current rwnd value, breaking the deadlock.",
    difficulty: "medium",
  },
  {
    id: "quiz-q3",
    bookId: "book-net-101",
    chapterId: "ch-3",
    pageNumber: 76,
    concept: "Subnetting",
    question: "A company needs to create a subnet for 50 host computers. Which CIDR prefix is the most efficient choice?",
    options: [
      { id: "opt-1", text: "/27 (30 usable hosts)", isCorrect: false },
      { id: "opt-2", text: "/26 (62 usable hosts)", isCorrect: true },
      { id: "opt-3", text: "/25 (126 usable hosts)", isCorrect: false },
      { id: "opt-4", text: "/24 (254 usable hosts)", isCorrect: false },
    ],
    explanation:
      "/26 provides 32 - 26 = 6 host bits. 2^6 - 2 = 62 usable addresses, which satisfies 50 hosts with minimal wasted IP space. /27 only provides 30 hosts (too small).",
    difficulty: "hard",
  },
];

export const DEMO_PROGRESS: StudentProgress = {
  totalStudyMinutes: 184,
  streakDays: 5,
  chaptersCompleted: 2,
  videosWatched: 7,
  quizzesCompleted: 14,
  questionsAsked: 38,
  activeSubject: "Computer Science - Computer Networks",
  concepts: DEMO_CONCEPTS,
  todayPlan: [
    {
      id: "plan-1",
      title: "Read Section 3.3: TCP Three-Way Handshake",
      type: "reading",
      target: "Page 72",
      completed: true,
      estimatedMinutes: 15,
    },
    {
      id: "plan-2",
      title: "Watch Lecture: TCP Connection Fundamentals",
      type: "video",
      target: "04:00 timestamp",
      completed: true,
      estimatedMinutes: 12,
    },
    {
      id: "plan-3",
      title: "Take 3-question Practice Quiz on Transport Layer",
      type: "quiz",
      target: "Chapter 3",
      completed: false,
      estimatedMinutes: 10,
    },
    {
      id: "plan-4",
      title: "Review Weak Concept: CIDR Subnetting Calculations",
      type: "review",
      target: "Page 76 (40% Mastery)",
      completed: false,
      estimatedMinutes: 15,
    },
  ],
};
