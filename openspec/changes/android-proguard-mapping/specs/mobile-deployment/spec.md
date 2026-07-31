# Mobile Deployment Pipeline Specification

## Purpose

The mobile deployment pipeline MUST upload the R8/ProGuard mapping file to Google Play Console as a deobfuscation file alongside each production AAB. This enables Google Play Console to deobfuscate crash and ANR stack traces automatically, removing the need for engineers to manually deobfuscate using a locally-generated `mapping.txt`.

The mapping file moves from the build job through an internal GitHub Actions artifact to the deploy job, where it is passed to the Play Console upload action. The mapping never becomes a public artifact.

## Requirements

### Requirement: Mapping Artifact Upload (build-android job)

The `build-android` job MUST upload the captured mapping file as a GitHub Actions artifact with a known name and 30-day retention.

#### Scenario: Mapping uploaded after successful build

- GIVEN the `build-android` job runs
- WHEN the Makefile target has produced the mapping file in the output directory
- THEN a GitHub Actions upload-artifact step MUST upload the file as `android-mapping`
- AND the retention period MUST be 30 days

#### Scenario: Mapping file is absent

- GIVEN the mapping file does not exist at the expected path
- WHEN the upload step runs
- THEN the step MUST NOT fail the job
- AND the job SHOULD use `if-no-files-found: warn` to log the absence without failing

### Requirement: Pipeline Dependency (deploy-play-store job)

The `deploy-play-store` job MUST depend on `build-android` so that the mapping artifact is available before the deploy step runs.

#### Scenario: Deploy job waits for mapping

- GIVEN the workflow triggers a production deployment
- WHEN the `deploy-play-store` job starts
- THEN `build-android` MUST be listed in the job's `needs` array alongside the existing `sign-android` dependency
- AND `deploy-play-store` MUST NOT start until both `build-android` and `sign-android` have completed

### Requirement: Mapping Artifact Download (deploy-play-store job)

The `deploy-play-store` job MUST download the `android-mapping` artifact before uploading to Play Console.

#### Scenario: Mapping is downloaded before deploy

- GIVEN `deploy-play-store` starts running
- WHEN both `build-android` and `sign-android` have completed
- THEN a download-artifact step MUST retrieve the `android-mapping` artifact
- AND the mapping file MUST be available at the expected path before the Play Console upload step runs

#### Scenario: No mapping artifact available

- GIVEN the `android-mapping` artifact was not uploaded (because the mapping file was absent in `build-android`)
- WHEN the download step runs
- THEN the download step MUST handle the missing artifact gracefully
- AND the deploy step SHOULD proceed without a mapping file

### Requirement: Play Console Mapping Upload

The `r0adkll/upload-google-play@v1` action MUST receive the `mappingFile` input pointing to the downloaded mapping file.

#### Scenario: Mapping file passed to Play Console upload

- GIVEN `deploy-play-store` has downloaded the mapping artifact
- WHEN the `Deploy AAB to Google Play Store` step runs
- THEN the `mappingFile` input MUST be set to the path of the downloaded mapping file
- AND the mapping file path MUST resolve to `<workspace>/apps/mobile/sonora-<tag>-mapping.txt`

#### Scenario: Multiple job tags are consistent

- GIVEN the `build-android` job uses a tag (e.g., via `outputs.tag_name`)
- WHEN the `mappingFile` path is constructed in `deploy-play-store`
- THEN the tag used in the mapping file name MUST reference the tag from `build-android` (not `sign-android` or any other source)

### Requirement: Mapping-AAB Release Consistency

The mapping file uploaded to Google Play Console MUST correspond to the same source code and build configuration as the AAB being deployed.

#### Scenario: Same build produces AAB and mapping

- GIVEN a single production build run
- WHEN both the AAB and the mapping file are generated
- THEN they originate from the same Gradle invocation
- AND the mapping is valid for deobfuscating the AAB's stack traces
- AND signing the AAB after the fact does not invalidate the mapping (signing does not re-obfuscate)

### Requirement: Graceful Degradation for Missing Mapping

The production deployment pipeline MUST NOT fail if the mapping file is absent at any stage. Absence of the mapping file MUST NOT block the AAB from reaching Play Console.

#### Scenario: Pipeline completes without mapping

- GIVEN the mapping file is missing at any stage (not generated, not uploaded, not downloaded)
- WHEN the pipeline runs
- THEN the AAB MUST still be uploaded to Play Console
- AND the pipeline MUST report success for the deploy stage
- AND the pipeline MAY log a warning about the missing mapping

### Requirement: One-Time R8 Configuration Verification

The pipeline maintainers MUST verify that the Android Gradle build has R8/minification enabled for release builds, ensuring the mapping file is generated.

#### Scenario: R8 is enabled in the generated Gradle config

- GIVEN the Android project is generated via `npx expo prebuild --platform android`
- WHEN the `android/app/build.gradle` file is inspected
- THEN the `release` build type MUST have `minifyEnabled true`
- AND R8 MUST be the default obfuscator (AGP 3.4+, which is used by Expo SDK 56)

#### Scenario: R8 is not enabled

- GIVEN `minifyEnabled` is not `true` in the release build type
- WHEN a production AAB is built
- THEN no `mapping.txt` is generated
- AND the pipeline MUST handle this gracefully (see Graceful Degradation requirement)
- AND the maintainers MUST add `minifyEnabled true` and a `proguard-rules.pro` to enable mapping generation
