<script setup lang="ts">
import type { TicketPaperWidth } from '#shared/types/ticket'

const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { settings, effectiveCharsPerLine } = usePrinterSettings()
const bluetooth = useBluetoothPrinter()
const pairing = shallowRef(false)

const widthItems = [
  { label: '80 mm', value: 80 as TicketPaperWidth },
  { label: '62 mm', value: 62 as TicketPaperWidth }
]

const methodItems = computed(() => [
  {
    label: 'Diálogo del sistema',
    value: 'dialog',
    description: 'Abre el ticket y usa la impresora instalada en el equipo (red o Bluetooth emparejada).'
  },
  {
    label: 'Red (ESC/POS)',
    value: 'network',
    description: 'Envía el ticket directo a la impresora por IP, sin diálogo y con corte automático.'
  },
  {
    label: 'Bluetooth (ESC/POS)',
    value: 'bluetooth',
    description: bluetooth.isSupported.value
      ? 'Conecta la impresora Bluetooth desde el navegador, sin diálogo.'
      : 'No disponible en este navegador (requiere Chrome y HTTPS).',
    disabled: !bluetooth.isSupported.value
  }
])

// UInputNumber clears to null; the setting keeps null as "automatic".
const charsPerLineDraft = computed({
  get: () => settings.value.charsPerLine,
  set: (value: number | null) => {
    settings.value.charsPerLine = value
  }
})

async function pairBluetooth() {
  pairing.value = true
  try {
    await bluetooth.pair()
    toast.add({ title: `Impresora conectada: ${bluetooth.deviceName.value}`, color: 'success' })
  } catch (pairError) {
    if (!(pairError instanceof DOMException && pairError.name === 'NotFoundError')) {
      toast.add({
        title: 'No fue posible conectar la impresora',
        description: pairError instanceof Error ? pairError.message : undefined,
        color: 'error'
      })
    }
  } finally {
    pairing.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Impresora de tickets"
    description="Configuración guardada en este equipo."
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Ancho del papel">
          <USelect
            v-model="settings.paperWidth"
            :items="widthItems"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Método de impresión">
          <URadioGroup
            v-model="settings.method"
            :items="methodItems"
          />
        </UFormField>

        <template v-if="settings.method === 'network'">
          <UFormField
            label="Dirección IP de la impresora"
            help="La impresora debe estar en la misma red que el servidor."
          >
            <UInput
              v-model="settings.networkHost"
              placeholder="192.168.1.50"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Puerto">
            <UInputNumber
              v-model="settings.networkPort"
              :min="1"
              :max="65535"
              :format-options="{ useGrouping: false }"
              class="w-full"
            />
          </UFormField>
        </template>

        <UFormField
          v-if="settings.method === 'bluetooth'"
          label="Impresora Bluetooth"
        >
          <div class="flex items-center gap-2">
            <UButton
              :label="bluetooth.deviceName.value ? 'Reconectar' : 'Emparejar'"
              icon="i-lucide-bluetooth"
              color="neutral"
              variant="outline"
              :loading="pairing"
              @click="pairBluetooth"
            />
            <UButton
              v-if="bluetooth.deviceName.value"
              label="Olvidar"
              icon="i-lucide-bluetooth-off"
              color="neutral"
              variant="ghost"
              @click="bluetooth.forget()"
            />
          </div>
          <p v-if="bluetooth.deviceName.value" class="mt-2 text-sm text-muted">
            Conectada: {{ bluetooth.deviceName.value }}
          </p>
        </UFormField>

        <UFormField
          v-if="settings.method !== 'dialog'"
          label="Caracteres por línea"
          :help="`Vacío = automático (${effectiveCharsPerLine} para ${settings.paperWidth} mm). Muchas impresoras angostas usan 32.`"
        >
          <UInputNumber
            v-model="charsPerLineDraft"
            :min="24"
            :max="64"
            placeholder="Automático"
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end">
          <UButton
            label="Cerrar"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
