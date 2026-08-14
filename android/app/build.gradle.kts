plugins {
    id("com.android.application")
}

val webDist = rootProject.layout.projectDirectory.dir("../dist")
val generatedOfflineAssets = layout.buildDirectory.dir("generated/offlineAssets")

android {
    namespace = "com.rpgcreatorai.editor"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.rpgcreatorai.editor"
        minSdk = 26
        targetSdk = 36
        versionCode = 5
        versionName = "0.5.0"
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main").assets.srcDir(generatedOfflineAssets)
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isDebuggable = false
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = true
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.16.0")
}

val syncOfflineWeb by tasks.registering(Sync::class) {
    group = "build setup"
    description = "Stages the relative-path Vite bundle as offline Android assets."
    from(webDist) {
        exclude("**/*.map", "**/.DS_Store")
    }
    into(generatedOfflineAssets.map { it.dir("www") })
    includeEmptyDirs = false

    doFirst {
        val indexFile = webDist.file("index.html").asFile
        check(indexFile.isFile) {
            "Missing ../dist/index.html. Produce the web bundle with a relative base before building Android."
        }
        val html = indexFile.readText(Charsets.UTF_8)
        val absoluteAssetReference = Regex("""(?i)(?:src|href)\s*=\s*[\"']/""")
        check(!absoluteAssetReference.containsMatchIn(html)) {
            "dist/index.html contains root-absolute assets. Build Vite with --base=./ for WebViewAssetLoader."
        }
    }
}

tasks.named("preBuild").configure {
    dependsOn(syncOfflineWeb)
}
