import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../core/theme';

const SECTIONS = [
    {
        title: '1. Información que Recopilamos',
        content: `Recopilamos la siguiente información cuando usas ObraTrack:

• Nombre completo y cédula (para identificación)
• Dirección de correo electrónico (para autenticación)
• Datos de proyectos: nombre, ubicación, avance y bitácoras
• Fotografías adjuntadas a registros diarios
• Ubicación GPS (solo para conductores, al confirmar envíos)
• Datos de materiales, personal y logística de tus proyectos`
    },
    {
        title: '2. Cómo Usamos tu Información',
        content: `Usamos tu información únicamente para:

• Autenticar tu identidad y gestionar tu cuenta
• Sincronizar tus datos entre dispositivos mediante Firebase (Google)
• Generar reportes PDF de tus proyectos
• Enviar notificaciones sobre actividad en tus proyectos
• Mejorar la funcionalidad de la aplicación

No vendemos, alquilamos ni compartimos tu información personal con terceros con fines comerciales.`
    },
    {
        title: '3. Almacenamiento y Seguridad',
        content: `Tus datos se almacenan en Google Firebase (Firestore y Firebase Storage), con servidores ubicados en Estados Unidos y sujetos a las políticas de privacidad de Google Cloud.

Implementamos medidas de seguridad estándar de la industria:
• Autenticación segura con Firebase Authentication
• Transmisión encriptada mediante HTTPS/TLS
• Reglas de acceso por rol (admin, coordinador, líder, conductor, logística)`
    },
    {
        title: '4. Datos de Terceros',
        content: `ObraTrack utiliza los siguientes servicios de terceros:

• Google Firebase (Auth, Firestore, Storage) — para autenticación y almacenamiento
• Google Analytics for Firebase — para análisis anónimo de uso
• Expo (infraestructura de build) — para distribución de la aplicación

Cada servicio tiene sus propias políticas de privacidad. Te recomendamos revisarlas.`
    },
    {
        title: '5. Tus Derechos',
        content: `Como usuario de ObraTrack tienes derecho a:

• Acceder a toda tu información personal almacenada
• Solicitar la corrección de datos incorrectos
• Solicitar la eliminación de tu cuenta y todos tus datos
• Exportar tus datos en formato PDF o Excel

Para ejercer cualquiera de estos derechos, contáctanos en el correo indicado al final.`
    },
    {
        title: '6. Retención de Datos',
        content: `Conservamos tus datos mientras tu cuenta esté activa. Si solicitas eliminar tu cuenta, eliminaremos todos tus datos personales y de proyectos en un plazo máximo de 30 días, excepto donde la ley lo requiera de otra forma.`
    },
    {
        title: '7. Menores de Edad',
        content: `ObraTrack está diseñado para uso profesional en la industria de la construcción. No recopilamos conscientemente información de personas menores de 18 años. Si eres menor de edad, no uses esta aplicación.`
    },
    {
        title: '8. Cambios a esta Política',
        content: `Podemos actualizar esta Política de Privacidad ocasionalmente. Te notificaremos sobre cambios significativos a través de la aplicación o por correo electrónico. El uso continuado de ObraTrack después de los cambios implica tu aceptación de la política actualizada.`
    },
    {
        title: '9. Contacto',
        content: `Si tienes preguntas sobre esta Política de Privacidad o sobre cómo manejamos tus datos, contáctanos:\n\n📧 soporte@obratrack.app\n🌐 www.obratrack.app`
    },
];

export default function PrivacyPolicyScreen() {
    const navigation = useNavigation<any>();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Política de Privacidad</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.intro}>
                    <Text style={styles.introDate}>Última actualización: Marzo 2026</Text>
                    <Text style={styles.introText}>
                        En ObraTrack nos comprometemos a proteger tu privacidad. Esta política
                        describe cómo recopilamos, usamos y protegemos tu información personal.
                    </Text>
                </View>

                {SECTIONS.map((section, i) => (
                    <View key={i} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <Text style={styles.sectionText}>{section.content}</Text>
                    </View>
                ))}

                <TouchableOpacity
                    style={styles.emailBtn}
                    onPress={() => Linking.openURL('mailto:soporte@obratrack.app')}
                >
                    <Icon name="mail" size={18} color={COLORS.white} />
                    <Text style={styles.emailBtnText}>Contactar Soporte</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
        backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border
    },
    backBtn: { marginRight: SPACING.md },
    headerTitle: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },

    content: { padding: SPACING.lg, paddingBottom: 60 },

    intro: {
        backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md,
        marginBottom: SPACING.lg, borderLeftWidth: 3, borderLeftColor: COLORS.primary
    },
    introDate: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: 'bold', marginBottom: 4 },
    introText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, lineHeight: 22 },

    section: {
        backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    sectionTitle: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: 'bold', marginBottom: SPACING.sm },
    sectionText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, lineHeight: 22 },

    emailBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.md, gap: 8, marginTop: SPACING.md
    },
    emailBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
});
