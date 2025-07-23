import type SDK from "@chili-publish/studio-sdk";
import { handleStudioFunc } from "./utils";
import { ConnectorType } from "@chili-publish/studio-sdk/lib/src/next/types/ConnectorTypes";
import type {
  ConnectorInstance,
  MediaDownloadType,
  MetaData,
} from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";

type DownloadMediaConnectorProps = {
  studio: SDK;
  connectorId: string;
  assetId: string;
  downloadType: MediaDownloadType;
  metadata: MetaData;
};

export async function downloadMediaConnector({
  studio,
  connectorId,
  assetId,
  downloadType,
  metadata = {},
}: DownloadMediaConnectorProps & { studio: SDK }) {
  return Result.wrap(studio.mediaConnector.download)(
    connectorId,
    assetId,
    downloadType,
    metadata,
  );
}

export async function getAllMediaConnectors(studio: SDK) {
  return handleStudioFunc(
    studio.next.connector.getAllByType,
    ConnectorType.media,
  );
}

const baseQueryOptions = {
  pageSize: 15,
  filter: [""],
};

/**
 * When you call you just add the pageToken that you get back to grab more things, when it is "" there is no more items
 *
 */

export async function queryMediaConnectorSimple(
  studio: SDK,
  connectorId: string,
  path: string,
  pageToken = "",
) {
  const queryOptions = {
    collection: path,
    pageToken,
    ...baseQueryOptions,
  };

  return handleStudioFunc(
    studio.mediaConnector.query,
    connectorId,
    queryOptions,
  );
}
