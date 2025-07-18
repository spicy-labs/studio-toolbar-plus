import type SDK from "@chili-publish/studio-sdk";
import { handleStudioFunc } from "./utils";
import { ConnectorType } from "@chili-publish/studio-sdk/lib/src/next/types/ConnectorTypes";
import type { ConnectorInstance } from "@chili-publish/studio-sdk";

export async function getAllMediaConnectors(studio: SDK) {
  return handleStudioFunc(
    studio.next.connector.getAllByType,
    ConnectorType.media
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
  pageToken = ""
) {
  const queryOptions = {
    collection: path,
    pageToken,
    ...baseQueryOptions,
  };

  return handleStudioFunc(
    studio.mediaConnector.query,
    connectorId,
    queryOptions
  );
}
