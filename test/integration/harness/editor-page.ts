import type { Page } from "@playwright/test";

declare global {
  var SDK: any;
}

export class EditorPage {
  constructor(private readonly page: Page) {}

  async waitForEngine(): Promise<void> {
    await this.page.evaluate(async () => {
      await window.SDK.editorAPI;
    });
  }

  async loadTemplate(templateJson: string): Promise<void> {
    await this.page.evaluate(async (templateJson) => {
      const sdk: any = window.SDK;
      const resp = await sdk.document.load(templateJson);
      if (!resp.success) {
        throw new Error(resp.error?.description ?? "SDK call failed");
      }
    }, templateJson);
  }

  async createListVariable(
    name: string,
    items: string[],
    value?: string,
  ): Promise<string> {
    return await this.page.evaluate(
      async ({ name, items, value }) => {
        const sdk: any = window.SDK;
        const createResp = await sdk.variable.create("", "list");
        if (!createResp.success) {
          throw new Error(createResp.error?.description ?? "SDK call failed");
        }
        const id = createResp.parsedData as string;

        const renameResp = await sdk.variable.rename(id, name);
        if (!renameResp.success) {
          throw new Error(renameResp.error?.description ?? "SDK call failed");
        }

        const nextValue = value && items.includes(value) ? value : items[0];
        const transitionalItems = items.includes("") ? items : ["", ...items];
        const transitionalListResp = await sdk.variable.setListVariable(
          id,
          transitionalItems,
        );
        if (!transitionalListResp.success) {
          throw new Error(
            transitionalListResp.error?.description ?? "SDK call failed",
          );
        }

        if (nextValue !== undefined) {
          const valueResp = await sdk.variable.setValue(id, nextValue);
          if (!valueResp.success) {
            throw new Error(valueResp.error?.description ?? "SDK call failed");
          }
        }

        const listResp = await sdk.variable.setListVariable(id, items);
        if (!listResp.success) {
          throw new Error(listResp.error?.description ?? "SDK call failed");
        }

        return id;
      },
      { name, items, value },
    );
  }

  async createShortTextVariable(name: string, value?: string): Promise<string> {
    return await this.page.evaluate(
      async ({ name, value }) => {
        const sdk: any = window.SDK;
        const createResp = await sdk.variable.create("", "shortText");
        if (!createResp.success) {
          throw new Error(createResp.error?.description ?? "SDK call failed");
        }
        const id = createResp.parsedData as string;

        const renameResp = await sdk.variable.rename(id, name);
        if (!renameResp.success) {
          throw new Error(renameResp.error?.description ?? "SDK call failed");
        }

        if (value !== undefined) {
          const valueResp = await sdk.variable.setValue(id, value);
          if (!valueResp.success) {
            throw new Error(valueResp.error?.description ?? "SDK call failed");
          }
        }

        return id;
      },
      { name, value },
    );
  }

  async createImageVariable(name: string): Promise<string> {
    return await this.page.evaluate(async (name) => {
      const sdk: any = window.SDK;
      const createResp = await sdk.variable.create("", "image");
      if (!createResp.success) {
        throw new Error(createResp.error?.description ?? "SDK call failed");
      }
      const id = createResp.parsedData as string;

      const renameResp = await sdk.variable.rename(id, name);
      if (!renameResp.success) {
        throw new Error(renameResp.error?.description ?? "SDK call failed");
      }

      return id;
    }, name);
  }

  async createBooleanVariable(name: string, value?: boolean): Promise<string> {
    return await this.page.evaluate(
      async ({ name, value }) => {
        const sdk: any = window.SDK;
        const createResp = await sdk.variable.create("", "boolean");
        if (!createResp.success) {
          throw new Error(createResp.error?.description ?? "SDK call failed");
        }
        const id = createResp.parsedData as string;

        const renameResp = await sdk.variable.rename(id, name);
        if (!renameResp.success) {
          throw new Error(renameResp.error?.description ?? "SDK call failed");
        }

        if (value !== undefined) {
          const valueResp = await sdk.variable.setValue(id, value);
          if (!valueResp.success) {
            throw new Error(valueResp.error?.description ?? "SDK call failed");
          }
        }

        return id;
      },
      { name, value },
    );
  }

  /**
   * Create a number variable. The engine stores number values as JS numbers and
   * rejects non-numeric strings, so `value` is coerced; a non-finite/blank value
   * is left at the engine default (0).
   */
  async createNumberVariable(name: string, value?: unknown): Promise<string> {
    const numeric = Number(value);
    const initial =
      value !== undefined && value !== "" && Number.isFinite(numeric)
        ? numeric
        : undefined;
    return await this.page.evaluate(
      async ({ name, initial }) => {
        const sdk: any = window.SDK;
        const createResp = await sdk.variable.create("", "number");
        if (!createResp.success) {
          throw new Error(createResp.error?.description ?? "SDK call failed");
        }
        const id = createResp.parsedData as string;

        const renameResp = await sdk.variable.rename(id, name);
        if (!renameResp.success) {
          throw new Error(renameResp.error?.description ?? "SDK call failed");
        }

        if (initial !== undefined) {
          const valueResp = await sdk.variable.setValue(id, initial);
          if (!valueResp.success) {
            throw new Error(valueResp.error?.description ?? "SDK call failed");
          }
        }

        return id;
      },
      { name, initial },
    );
  }

  async setVariableValue(
    name: string,
    value: string | boolean | number,
  ): Promise<void> {
    await this.page.evaluate(
      async ({ name, value }) => {
        const sdk: any = window.SDK;
        const variableResp = await sdk.variable.getByName(name);
        if (!variableResp.success) {
          throw new Error(variableResp.error?.description ?? "SDK call failed");
        }
        const id = variableResp.parsedData.id as string;

        const valueResp = await sdk.variable.setValue(id, value);
        if (!valueResp.success) {
          throw new Error(valueResp.error?.description ?? "SDK call failed");
        }
      },
      { name, value },
    );
  }

  async getVariableValue(name: string): Promise<any> {
    return await this.page.evaluate(async (name) => {
      const sdk: any = window.SDK;
      const resp = await sdk.variable.getByName(name);
      if (!resp.success) {
        throw new Error(resp.error?.description ?? "SDK call failed");
      }
      return resp.parsedData.value;
    }, name);
  }

  async getAllVariables(): Promise<
    Array<{ id: string; name: string; type: string; value: any }>
  > {
    return await this.page.evaluate(async () => {
      const sdk: any = window.SDK;
      const resp = await sdk.variable.getAll();
      if (!resp.success) {
        throw new Error(resp.error?.description ?? "SDK call failed");
      }
      return resp.parsedData.map((variable: any) => ({
        id: variable.id,
        name: variable.name,
        type: variable.type,
        value: variable.value,
      }));
    });
  }

  async getLayouts(): Promise<Array<{ id: string; name: string }>> {
    return await this.page.evaluate(async () => {
      const sdk: any = window.SDK;
      const resp = await sdk.layout.getAll();
      if (!resp.success) {
        throw new Error(resp.error?.description ?? "SDK call failed");
      }
      return resp.parsedData.map((layout: any) => ({
        id: layout.id,
        name: layout.name,
      }));
    });
  }

  async renameLayout(currentName: string, newName: string): Promise<void> {
    await this.page.evaluate(
      async ({ currentName, newName }) => {
        const sdk: any = window.SDK;
        const layoutResp = await sdk.layout.getByName(currentName);
        if (!layoutResp.success) {
          throw new Error(layoutResp.error?.description ?? "SDK call failed");
        }

        const renameResp = await sdk.layout.rename(
          layoutResp.parsedData.id,
          newName,
        );
        if (!renameResp.success) {
          throw new Error(renameResp.error?.description ?? "SDK call failed");
        }
      },
      { currentName, newName },
    );
  }

  async selectLayout(name: string): Promise<void> {
    await this.page.evaluate(async (name) => {
      const sdk: any = window.SDK;
      const layoutResp = await sdk.layout.getByName(name);
      if (!layoutResp.success) {
        throw new Error(layoutResp.error?.description ?? "SDK call failed");
      }

      const selectResp = await sdk.layout.select(layoutResp.parsedData.id);
      if (!selectResp.success) {
        throw new Error(selectResp.error?.description ?? "SDK call failed");
      }
    }, name);
  }

  async createChildLayout(
    parentName: string,
    childName: string,
  ): Promise<string> {
    return await this.page.evaluate(
      async ({ parentName, childName }) => {
        const sdk: any = window.SDK;
        const parentResp = await sdk.layout.getByName(parentName);
        if (!parentResp.success) {
          throw new Error(parentResp.error?.description ?? "SDK call failed");
        }

        const createResp = await sdk.layout.create(parentResp.parsedData.id);
        if (!createResp.success) {
          throw new Error(createResp.error?.description ?? "SDK call failed");
        }
        const id = createResp.parsedData as string;

        const renameResp = await sdk.layout.rename(id, childName);
        if (!renameResp.success) {
          throw new Error(renameResp.error?.description ?? "SDK call failed");
        }

        return id;
      },
      { parentName, childName },
    );
  }

  async deployAction(
    script: string,
    triggers: Array<{ event: string }>,
  ): Promise<string> {
    return await this.page.evaluate(
      async ({ script, triggers }) => {
        const sdk: any = window.SDK;
        const createResp = await sdk.action.create();
        if (!createResp.success) {
          throw new Error(createResp.error?.description ?? "SDK call failed");
        }
        const id = createResp.parsedData as string;

        const updateResp = await sdk.action.update(id, {
          script,
          name: "INTEGRATION_TEST",
          triggers,
        });
        if (!updateResp.success) {
          throw new Error(updateResp.error?.description ?? "SDK call failed");
        }

        return id;
      },
      { script, triggers },
    );
  }

  async enableActions(): Promise<void> {
    await this.page.evaluate(async () => {
      const sdk: any = window.SDK;
      const resp = await sdk.action.enable();
      if (!resp.success) {
        throw new Error(resp.error?.description ?? "SDK call failed");
      }
    });
  }

  async disableActions(): Promise<void> {
    await this.page.evaluate(async () => {
      const sdk: any = window.SDK;
      const resp = await sdk.action.disable();
      if (!resp.success) {
        throw new Error(resp.error?.description ?? "SDK call failed");
      }
    });
  }

  async removeAllActions(): Promise<void> {
    await this.page.evaluate(async () => {
      const sdk: any = window.SDK;
      const actionsResp = await sdk.action.getAll();
      if (!actionsResp.success) {
        throw new Error(actionsResp.error?.description ?? "SDK call failed");
      }

      for (const action of actionsResp.parsedData) {
        const removeResp = await sdk.action.remove(action.id);
        if (!removeResp.success) {
          throw new Error(removeResp.error?.description ?? "SDK call failed");
        }
      }
    });
  }
}
