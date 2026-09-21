import { Setting, PluginSettingTab } from "obsidian";
import { getDailyNoteSettings } from "obsidian-daily-notes-interface";

export default class RolloverSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async getTemplateHeadings() {
    const { template } = this.plugin.getNoteSettings();
    if (!template) return [];

    let file = this.app.vault.getAbstractFileByPath(template);

    if (file === null) {
      file = this.app.vault.getAbstractFileByPath(template + ".md");
    }

    if (file === null) {
      // file not available, no template-heading can be returned
      return [];
    }

    const templateContents = await this.app.vault.read(file);
    const allHeadings = Array.from(templateContents.matchAll(/#{1,} .*/g)).map(
      ([heading]) => heading
    );
    return allHeadings;
  }

  async display() {
    const templateHeadings = await this.getTemplateHeadings();

    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Custom weekly notes")
      .setDesc("Use Monday–Sunday filenames such as 2026-0921-0927. Use Open current weekly note; disable core Daily Notes to avoid creating alternate filenames. Reload after toggling to update the ribbon.")
      .addToggle(toggle => toggle.setValue(this.plugin.settings.weeklyNotesEnabled || false).onChange(async value => {
        this.plugin.settings.weeklyNotesEnabled = value;
        await this.plugin.saveSettings();
      }));
    for (const [key, name] of [["weeklyFolder", "Weekly folder"], ["weeklyTemplate", "Weekly template"]]) {
      new Setting(this.containerEl).setName(name).addText(text => text
        .setValue(this.plugin.settings[key] || "")
        .onChange(async value => { this.plugin.settings[key] = value; await this.plugin.saveSettings(); }));
    }
    new Setting(this.containerEl)
      .setName("Template heading")
      .setDesc("Which heading from your template should the todos go under")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            ...templateHeadings.reduce((acc, heading) => {
              acc[heading] = heading;
              return acc;
            }, {}),
            none: "None",
          })
          .setValue(this.plugin?.settings.templateHeading)
          .onChange((value) => {
            this.plugin.settings.templateHeading = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(this.containerEl)
      .setName("Delete todos from previous day")
      .setDesc(
        `Move rolled tasks out of the previous note after writing the destination. Completed branches stay in place; a moved parent becomes a plain context bullet when needed. Disable to keep the source unchanged.`
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.deleteOnComplete || false)
          .onChange((value) => {
            this.plugin.settings.deleteOnComplete = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(this.containerEl)
      .setName("Remove empty todos in rollover")
      .setDesc(
        `If you have empty todos, they will not be rolled over to the next day.`
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.removeEmptyTodos || false)
          .onChange((value) => {
            this.plugin.settings.removeEmptyTodos = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(this.containerEl)
      .setName("Roll over children of todos")
      .setDesc(
        `Include nested supporting text with open tasks. Completed tasks and all their descendants always stay in the previous note. Incomplete descendants of completed parents never roll over.`
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rolloverChildren || false)
          .onChange((value) => {
            this.plugin.settings.rolloverChildren = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(this.containerEl)
      .setName("Automatic rollover on note creation")
      .setDesc(
        `If enabled, the plugin will automatically rollover todos when you create the current daily or weekly note.`
      )
      .addToggle((toggle) =>
        toggle
          // Default to true if the setting is not set
          .setValue(
            this.plugin.settings.rolloverOnFileCreate === undefined ||
              this.plugin.settings.rolloverOnFileCreate === null
              ? true
              : this.plugin.settings.rolloverOnFileCreate
          )
          .onChange((value) => {
            console.log(value);
            this.plugin.settings.rolloverOnFileCreate = value;
            this.plugin.saveSettings();
            this.plugin.loadData().then((value) => console.log(value));
          })
      );

    new Setting(this.containerEl)
      .setName("Done status markers")
      .setDesc(
        `Characters that represent done status in checkboxes. Default is "xX-". Add any characters that should be considered as marking a task complete.`
      )
      .addText((text) =>
        text
          .setValue(this.plugin.settings.doneStatusMarkers || "xX-")
          .onChange((value) => {
            this.plugin.settings.doneStatusMarkers = value;
            this.plugin.saveSettings();
          })
      );
    new Setting(this.containerEl)
      .setName("Add extra blank line between Heading and Todos")
      .setDesc(`Whether to add an extra blank line between the selected Heading and the rolled over todos. This will only work in combination with a configured Template Heading.`)
      .addToggle((toggle) => 
        toggle
          .setValue(
            this.plugin.settings
              .leadingNewLine === undefined || 
              this.plugin.settings.leadingNewLine === null 
              ? true 
              : this.plugin.settings.leadingNewLine
          )
          .onChange((value) => {
            this.plugin.settings.leadingNewLine = value;
            this.plugin.saveSettings();
          })
      );
  }
}
