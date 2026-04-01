<script setup lang="ts">
import { onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useConfigStore } from '@/stores/configs'

const emit = defineEmits<{
  edit: [id: string]
  create: []
}>()

const store = useConfigStore()

onMounted(() => store.fetchAll())

async function handleDelete(id: string, name: string) {
  await ElMessageBox.confirm(`Delete config "${name}"?`, 'Confirm', { type: 'warning' })
  await store.remove(id)
  ElMessage.success('Deleted')
}

function copyGenerateUrl(id: string) {
  navigator.clipboard.writeText(store.getGenerateUrl(id))
  ElMessage.success('Generate URL copied')
}

function openGenerateUrl(id: string) {
  window.open(store.getGenerateUrl(id), '_blank')
}

function formatDate(s: string) {
  return new Date(s).toLocaleString()
}
</script>

<template>
  <div style="padding: 24px">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
      <h2 style="font-size: 20px; font-weight: 600">Configs</h2>
      <el-button type="primary" @click="emit('create')">
        <el-icon><Plus /></el-icon>
        New Config
      </el-button>
    </div>

    <el-table :data="store.items" v-loading="store.loading" border style="width: 100%">
      <el-table-column prop="name" label="Name" min-width="200" />
      <el-table-column label="Created" width="180">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="Updated" width="180">
        <template #default="{ row }">{{ formatDate(row.updated_at) }}</template>
      </el-table-column>
      <el-table-column label="Actions" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="emit('edit', row.id)">
            <el-icon><Edit /></el-icon>
            Edit
          </el-button>
          <el-button size="small" @click="copyGenerateUrl(row.id)">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
          <el-button size="small" @click="openGenerateUrl(row.id)">
            <el-icon><Link /></el-icon>
          </el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.id, row.name)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>

  </div>
</template>
