import axios from "axios";
import { Prices } from "../types/index";

export async function fetchPrices(assetIds: string[]): Promise<Prices> {
  const response = await axios.get<Prices>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${assetIds.join(",")}&vs_currencies=usd`
  );
  return response.data;
}
