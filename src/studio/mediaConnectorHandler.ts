import type SDK from "@chili-publish/studio-sdk";
import { handleStudioFunc } from "./utils";
import { ConnectorType } from "@chili-publish/studio-sdk/lib/src/next/types/ConnectorTypes";
import type {
  ConnectorInstance,
  MediaDownloadType,
  MetaData,
} from "@chili-publish/studio-sdk";
import { Result } from "typescript-result";
import type {
  EditorResponse,
  EditorResponseError,
} from "@chili-publish/studio-sdk/lib/src/types/CommonTypes";

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
  ).map((maybeArr) => {
    if (maybeArr instanceof Uint8Array) {
      return maybeArr;
    }

    const editorResponse = maybeArr as EditorResponse<EditorResponseError>;

    if (editorResponse.error) {
      return Result.error(
        new Error(
          `Studio Returned Error ${editorResponse.status}:${editorResponse.error}`,
        ),
      );
    } else {
      return Result.error(new Error("Unknown error during donwload"));
    }
  });
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
