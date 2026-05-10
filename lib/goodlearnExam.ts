import { createPublicClient, decodeEventLog, encodeFunctionData, http, type Hex } from "viem";
import { celo } from "viem/chains";

export const CELO_CHAIN_ID = "0xa4ec";
export const GOODLEARN_EXAM_ADDRESS = process.env.NEXT_PUBLIC_GOODLEARN_EXAM_ADDRESS as Hex | undefined;
export const GOODLEARN_EXAM_DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_GOODLEARN_EXAM_DEPLOY_BLOCK || "0");
export const GOODLEARN_EXAM_RPC_URL = process.env.NEXT_PUBLIC_CELO_RPC_URL || "https://forno.celo.org";
export const GOODLEARN_EXAM_ENUMERATION_LIMIT = Number(process.env.NEXT_PUBLIC_GOODLEARN_EXAM_ENUMERATION_LIMIT || "250");

export const goodLearnExamAbi = [
  {
    type: "function",
    name: "publishFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "nextExamId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getExam",
    stateMutability: "view",
    inputs: [{ name: "examId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "creator", type: "address" },
        { name: "moduleId", type: "bytes32" },
        { name: "questionSetHash", type: "bytes32" },
        { name: "questionCount", type: "uint256" },
        { name: "rewardPerCorrect", type: "uint256" },
        { name: "maxParticipants", type: "uint256" },
        { name: "participantCount", type: "uint256" },
        { name: "timerSeconds", type: "uint256" },
        { name: "startTime", type: "uint256" },
        { name: "endTime", type: "uint256" },
        { name: "correctionUnlockTime", type: "uint256" },
        { name: "correctAnswerCommitment", type: "bytes32" },
        { name: "revealedAnswers", type: "string" },
        { name: "corrected", type: "bool" },
        { name: "settingsLocked", type: "bool" },
      ],
    }],
  },
  {
    type: "event",
    name: "ExamCreated",
    inputs: [
      { name: "examId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "moduleId", type: "bytes32", indexed: true },
      { name: "questionSetHash", type: "bytes32", indexed: false },
      { name: "questionCount", type: "uint256", indexed: false },
      { name: "rewardPerCorrect", type: "uint256", indexed: false },
      { name: "maxParticipants", type: "uint256", indexed: false },
      { name: "timerSeconds", type: "uint256", indexed: false },
      { name: "startTime", type: "uint256", indexed: false },
      { name: "endTime", type: "uint256", indexed: false },
      { name: "correctionUnlockTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "createExam",
    stateMutability: "payable",
    inputs: [
      { name: "moduleId", type: "bytes32" },
      { name: "questionSetHash", type: "bytes32" },
      { name: "questionCount", type: "uint256" },
      { name: "rewardPerCorrect", type: "uint256" },
      { name: "maxParticipants", type: "uint256" },
      { name: "timerSeconds", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "correctionDelaySeconds", type: "uint256" },
      { name: "correctAnswerCommitment", type: "bytes32" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export type GoodLearnExamRecord = {
  creator: Hex;
  moduleId: Hex;
  questionSetHash: Hex;
  questionCount: bigint;
  rewardPerCorrect: bigint;
  maxParticipants: bigint;
  participantCount: bigint;
  timerSeconds: bigint;
  startTime: bigint;
  endTime: bigint;
  correctionUnlockTime: bigint;
  correctAnswerCommitment: Hex;
  revealedAnswers: string;
  corrected: boolean;
  settingsLocked: boolean;
};

export type OnChainExamListing = GoodLearnExamRecord & {
  examId: bigint;
  transactionHash?: Hex;
  blockNumber?: bigint;
  status: "upcoming" | "active" | "ended" | "corrected";
};

export function createGoodLearnPublicClient() {
  return createPublicClient({ chain: celo, transport: http(GOODLEARN_EXAM_RPC_URL) });
}

export function getCreateExamData(args: readonly [Hex, Hex, bigint, bigint, bigint, bigint, bigint, bigint, bigint, Hex]) {
  return encodeFunctionData({ abi: goodLearnExamAbi, functionName: "createExam", args });
}

export function getPublishFeeData() {
  return encodeFunctionData({ abi: goodLearnExamAbi, functionName: "publishFee" });
}

export function getExamStatus(exam: Pick<GoodLearnExamRecord, "startTime" | "endTime" | "corrected">, nowSeconds = Math.floor(Date.now() / 1000)): OnChainExamListing["status"] {
  if (exam.corrected) {
    return "corrected";
  }

  if (BigInt(nowSeconds) < exam.startTime) {
    return "upcoming";
  }

  if (BigInt(nowSeconds) <= exam.endTime) {
    return "active";
  }

  return "ended";
}

export async function getOnChainExamListings(contractAddress: Hex = GOODLEARN_EXAM_ADDRESS as Hex): Promise<OnChainExamListing[]> {
  if (!contractAddress) {
    throw new Error("NEXT_PUBLIC_GOODLEARN_EXAM_ADDRESS is missing. Add the deployed GoodLearnExam address to load on-chain exams.");
  }

  const client = createGoodLearnPublicClient();

  try {
    const logs = await client.getContractEvents({
      address: contractAddress,
      abi: goodLearnExamAbi,
      eventName: "ExamCreated",
      fromBlock: GOODLEARN_EXAM_DEPLOY_BLOCK,
      toBlock: "latest",
    });

    if (logs.length > 0) {
      return getListingsFromLogs(client, contractAddress, logs as ExamCreatedLog[]);
    }
  } catch (error) {
    const listings = await getListingsByEnumeratingExamIds(client, contractAddress);

    if (listings.length > 0) {
      return listings;
    }

    throw error;
  }

  return getListingsByEnumeratingExamIds(client, contractAddress);
}

type GoodLearnPublicClient = ReturnType<typeof createGoodLearnPublicClient>;
type ExamCreatedLog = {
  args: { examId?: bigint };
  transactionHash?: Hex | null;
  blockNumber?: bigint | null;
};

async function getListingsFromLogs(client: GoodLearnPublicClient, contractAddress: Hex, logs: ExamCreatedLog[]) {
  const uniqueExamIds = [...new Set(logs.map(log => log.args.examId?.toString()).filter((examId): examId is string => Boolean(examId)))];
  const listings = await Promise.all(uniqueExamIds.map(async examIdText => {
    const examId = BigInt(examIdText);
    const log = logs.find(candidate => candidate.args.examId === examId);

    return getListingByExamId(client, contractAddress, examId, log);
  }));

  return sortListings(listings);
}

async function getListingsByEnumeratingExamIds(client: GoodLearnPublicClient, contractAddress: Hex) {
  const nextExamId = await client.readContract({ address: contractAddress, abi: goodLearnExamAbi, functionName: "nextExamId" }) as bigint;
  const lastExamId = nextExamId - 1n;

  if (lastExamId < 1n) {
    return [];
  }

  const examCountToLoad = Math.min(Number(lastExamId), GOODLEARN_EXAM_ENUMERATION_LIMIT);
  const firstExamIdToLoad = lastExamId - BigInt(examCountToLoad) + 1n;
  const examIds = Array.from({ length: examCountToLoad }, (_, index) => firstExamIdToLoad + BigInt(index));
  const listings = await Promise.all(examIds.map(examId => getListingByExamId(client, contractAddress, examId)));

  return sortListings(listings);
}

async function getListingByExamId(client: GoodLearnPublicClient, contractAddress: Hex, examId: bigint, log?: ExamCreatedLog): Promise<OnChainExamListing> {
  const exam = await client.readContract({ address: contractAddress, abi: goodLearnExamAbi, functionName: "getExam", args: [examId] }) as GoodLearnExamRecord;

  return {
    ...exam,
    examId,
    transactionHash: log?.transactionHash ?? undefined,
    blockNumber: log?.blockNumber ?? undefined,
    status: getExamStatus(exam),
  };
}

function sortListings(listings: OnChainExamListing[]) {
  return listings.sort((left, right) => Number(right.examId - left.examId));
}

export function decodeExamCreatedLog(data: Hex, topics: [Hex, ...Hex[]]) {
  return decodeEventLog({ abi: goodLearnExamAbi, data, topics });
}
