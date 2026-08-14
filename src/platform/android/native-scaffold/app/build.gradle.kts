plugins { id("com.android.application") }

fun environmentValue(name: String): String? = System.getenv(name)?.trim()?.takeIf { it.isNotEmpty() }

val releaseStoreFileValue = environmentValue("RPGCREATORAI_RELEASE_STORE_FILE")
val releaseStorePassword = environmentValue("RPGCREATORAI_RELEASE_STORE_PASSWORD")
val releaseKeyAlias = environmentValue("RPGCREATORAI_RELEASE_KEY_ALIAS")
val releaseKeyPassword = environmentValue("RPGCREATORAI_RELEASE_KEY_PASSWORD")
val releaseStoreFile = releaseStoreFileValue?.let { project.file(it) }
val releaseSigningMissing = buildList {
    if (releaseStoreFileValue == null) add("RPGCREATORAI_RELEASE_STORE_FILE")
    else if (releaseStoreFile == null || !releaseStoreFile.isFile) add("RPGCREATORAI_RELEASE_STORE_FILE (existing file)")
    if (releaseStorePassword == null) add("RPGCREATORAI_RELEASE_STORE_PASSWORD")
    if (releaseKeyAlias == null) add("RPGCREATORAI_RELEASE_KEY_ALIAS")
    if (releaseKeyPassword == null) add("RPGCREATORAI_RELEASE_KEY_PASSWORD")
}
val releaseSigningReady = releaseSigningMissing.isEmpty()
val releaseSigningError = "Release signing is intentionally fail-closed. Set the external keystore variables before assembling a release: ${releaseSigningMissing.joinToString(", ")}."

android {
    namespace = "ai.rpgcreator.player"
    compileSdk = 36

    defaultConfig {
        applicationId = "ai.rpgcreator.player"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        if (releaseSigningReady) {
            create("release") {
                storeFile = releaseStoreFile!!
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

tasks.configureEach {
    if (name == "preReleaseBuild" || name == "validateSigningRelease" ||
        name == "assembleRelease" || name == "bundleRelease" || name == "packageRelease") {
        doFirst {
            if (!releaseSigningReady) throw GradleException(releaseSigningError)
        }
    }
}
