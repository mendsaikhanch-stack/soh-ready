import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release гарын үсэг — keystore репоны ГАДНА (git-д орохгүй). Замыг
// KHOTOL_SMS_KEYSTORE_PROPS env эсвэл C:/Users/User/Android/keys/keystore.properties.
// Түлхүүр алдагдвал шинэ хувилбарыг дээр нь суулгаж чадахгүй (устгаж байж).
val releaseProps = Properties().apply {
    val path = System.getenv("KHOTOL_SMS_KEYSTORE_PROPS") ?: "C:/Users/User/Android/keys/keystore.properties"
    val file = File(path)
    if (file.isFile) file.inputStream().use { load(it) }
}

android {
    namespace = "mn.khotol.smsrelay"
    compileSdk = 36

    defaultConfig {
        applicationId = "mn.khotol.smsrelay"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (releaseProps.containsKey("storeFile")) {
            create("release") {
                storeFile = File(releaseProps.getProperty("storeFile"))
                storePassword = releaseProps.getProperty("storePassword")
                keyAlias = releaseProps.getProperty("keyAlias")
                keyPassword = releaseProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.findByName("release")
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    testImplementation("junit:junit:4.13.2")
}
