import fs from 'node:fs/promises';
import path from 'node:path';

import { type ConfigPlugin, IOSConfig, withXcodeProject } from 'expo/config-plugins';

/**
 * The Info.plist key iOS answers the "while using the app" location prompt with.
 * `expo-location`'s plugin writes its unlocalized value; the per-language
 * `InfoPlist.strings` written below is what iOS prefers at runtime.
 */
export const LOCATION_USAGE_INFO_PLIST_KEY = 'NSLocationWhenInUseUsageDescription';

/** Where Expo prebuild keeps the app's localized strings. */
const SUPPORTING_DIRECTORY = 'Supporting';
const STRINGS_FILE_NAME = 'InfoPlist.strings';

export type InfoPlistStringsLink = {
  /** The `path` a new file reference needs, relative to the group it goes in. */
  referencePath: string;
  /** The project already points at this file, so no second reference may be added. */
  alreadyLinked: boolean;
};

export type InfoPlistStringsLinkInput = {
  /** The language the copy is written for, e.g. `es`. */
  language: string;
  /**
   * The `path` of the group that will hold the reference, as the Xcode project records
   * it. A group created by Expo's helper carries `""`, and a non-clean prebuild can
   * leave one that carries the `.lproj` directory itself.
   */
  groupPath?: string | null;
  /** The `path` of every file reference already inside that group. */
  groupReferences?: readonly string[];
  /** The `path` of every file reference the project already carries. */
  projectReferences?: readonly string[];
  fileName?: string;
};

export type LocalizedLocationPermissionProps = {
  /**
   * Usage-description copy keyed by language, one entry per declared language. The i18n
   * resources are the single source of this copy; the plugin only transports it into the
   * native project, so no user-facing sentence is restated here.
   */
  messages: Record<string, string>;
};

function escapeStringsValue(message: string): string {
  return message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * The body of `<language>.lproj/InfoPlist.strings` for one language: a `.strings` file
 * holds `key = "value";` pairs, and iOS picks the file by the `.lproj` folder it sits in,
 * which is why the file itself carries no language-specific key.
 *
 * A language without copy is refused rather than written empty: an empty usage
 * description is rejected on upload, and a silently skipped language would leave the
 * permission prompt untranslated with nothing to show for it.
 */
export function buildInfoPlistStrings(
  language: string,
  messages: Readonly<Record<string, string>>,
): string {
  const message = messages[language];
  if (!message) {
    throw new Error(
      `No ${LOCATION_USAGE_INFO_PLIST_KEY} copy is declared for language "${language}". ` +
        `Declared languages: ${Object.keys(messages).join(', ')}.`,
    );
  }

  return `${LOCATION_USAGE_INFO_PLIST_KEY} = "${escapeStringsValue(message)}";\n`;
}

/**
 * Write the `<language>.lproj/InfoPlist.strings` of one language under the app's
 * supporting directory and return the path written.
 *
 * The content is built before anything touches the disk, so a language with no copy
 * leaves no directory and no empty file behind.
 */
export async function writeInfoPlistStringsFile(
  supportingDirectory: string,
  language: string,
  messages: Readonly<Record<string, string>>,
): Promise<string> {
  const content = buildInfoPlistStrings(language, messages);
  const lprojDirectory = path.join(supportingDirectory, `${language}.lproj`);
  const stringsFile = path.join(lprojDirectory, STRINGS_FILE_NAME);

  await fs.mkdir(lprojDirectory, { recursive: true });
  await fs.writeFile(stringsFile, content);

  return stringsFile;
}

/** Strip the quoting Xcode's model keeps around a path and normalize the separators. */
function normalizeProjectPath(value: string): string {
  return value
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '');
}

/**
 * Decide what a `<language>.lproj/InfoPlist.strings` file reference has to carry, and
 * whether the project already has it.
 *
 * Xcode resolves a reference against the `path` of the group it sits in, so the reference
 * path depends on that group:
 *
 * - A group created by `ensureGroupRecursively` carries no path (`""`), so the reference
 *   has to bring the directory itself: `es.lproj/InfoPlist.strings`.
 * - A group that already carries the directory (a non-clean prebuild can leave
 *   `path = es.lproj` behind) must get the bare file name. Repeating the directory there
 *   resolves to `es.lproj/es.lproj/InfoPlist.strings`, which Xcode cannot find, and the
 *   resource silently misses the bundle.
 */
export function planInfoPlistStringsLink({
  language,
  groupPath,
  groupReferences = [],
  projectReferences = [],
  fileName = STRINGS_FILE_NAME,
}: InfoPlistStringsLinkInput): InfoPlistStringsLink {
  const localizedDirectory = `${language}.lproj`;
  const targetPath = `${localizedDirectory}/${fileName}`;
  const normalizedGroupPath = normalizeProjectPath(groupPath ?? '');

  const groupIsLocalized = normalizedGroupPath.split('/').pop() === localizedDirectory;
  const referencePath = groupIsLocalized ? fileName : targetPath;

  const resolvesToTarget = (reference: string, basePath = ''): boolean => {
    const resolved = normalizeProjectPath([basePath, reference].filter(Boolean).join('/'));
    return resolved === targetPath || resolved.endsWith(`/${targetPath}`);
  };

  const alreadyLinked =
    projectReferences.some((reference) => resolvesToTarget(reference)) ||
    groupReferences.some((reference) => resolvesToTarget(reference, normalizedGroupPath));

  return { referencePath, alreadyLinked };
}

/** A file reference of the Xcode project, as far as its path is concerned. */
type FileReference = { path?: string };

/**
 * The `path` of every file reference the project carries, limited to the given group
 * children when they are passed. `pbxFileReferenceSection()` also holds `_comment`
 * entries, which are plain strings and carry no path.
 */
function fileReferencePaths(project: unknown, children?: readonly { value: string }[]): string[] {
  const section = (
    project as { pbxFileReferenceSection: () => Record<string, FileReference | string> }
  ).pbxFileReferenceSection();
  const keys = children ? children.map((child) => child.value) : Object.keys(section);

  return keys
    .map((key) => section[key])
    .map((reference) => (typeof reference === 'string' ? undefined : reference?.path))
    .filter((referencePath): referencePath is string => typeof referencePath === 'string');
}

/**
 * Write one `<language>.lproj/InfoPlist.strings` per declared language and link each into
 * the application target's copy-bundle-resources phase.
 *
 * The linkage reuses the helpers Expo's own `locales` writer uses
 * (`IOSConfig.Locales.writeStringsFile`): the same group layout and a copy-bundle-resources
 * entry, because a file that only exists on disk is not copied into the app bundle. The
 * file body comes from {@link buildInfoPlistStrings} instead of a `locales` map so the
 * localized copy stays in the i18n resources, and the reference path comes from
 * {@link planInfoPlistStringsLink} so a non-clean prebuild links the same file once, with
 * a path that resolves from wherever the language group sits.
 *
 * What cannot be proven here: the Xcode result. The project graph, the group paths a
 * non-clean prebuild leaves behind and the copy-bundle-resources entry only exist inside
 * a generated `ios/` project, and no test in this repository runs a prebuild.
 */
export const withLocalizedLocationPermission: ConfigPlugin<LocalizedLocationPermissionProps> = (
  config,
  { messages },
) =>
  withXcodeProject(config, async (modConfig) => {
    const projectRoot = modConfig.modRequest.projectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const supportingDirectory = path.join(projectRoot, 'ios', projectName, SUPPORTING_DIRECTORY);

    for (const language of Object.keys(messages)) {
      const stringsFile = await writeInfoPlistStringsFile(supportingDirectory, language, messages);

      const groupName = [projectName, SUPPORTING_DIRECTORY, `${language}.lproj`].join('/');
      const group = IOSConfig.XcodeUtils.ensureGroupRecursively(modConfig.modResults, groupName);
      const groupChildren = group?.children as readonly { value: string }[] | undefined;
      const plan = planInfoPlistStringsLink({
        language,
        groupPath: group?.path,
        groupReferences: fileReferencePaths(modConfig.modResults, groupChildren),
        projectReferences: fileReferencePaths(modConfig.modResults),
      });

      if (plan.alreadyLinked) {
        continue;
      }

      modConfig.modResults = IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: plan.referencePath,
        groupName,
        project: modConfig.modResults,
        isBuildFile: true,
        verbose: true,
      });
    }

    return modConfig;
  });

export default withLocalizedLocationPermission;
