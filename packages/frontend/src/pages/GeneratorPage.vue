<script setup lang="ts">
import {type DeepReadonly, onMounted, ref} from "vue";
import GeneratorDrawer from "@components/GeneratorDrawer.vue";
import {useGeneratorStore} from "@/stores.ts";
import {ElMessage} from "element-plus";
import {storeToRefs} from "pinia";
import type {Generator} from "@psc/common";
import {Delete, Edit, View} from '@element-plus/icons-vue'
import MonacoEditor from "@components/MonacoEditor.vue";

const drawerVisible = ref(false);
const previewVisible = ref(false);
const previewContent = ref("");
const subscriptionGeneratorStore = useGeneratorStore();
const {generators} = storeToRefs(subscriptionGeneratorStore);
onMounted(() => {
  subscriptionGeneratorStore.forceReloadGenerators()
      .catch(err => {
        ElMessage.error(getErrorMessage(err.message));
      });
})

const selectedGenerator = ref<DeepReadonly<Generator> | undefined>(undefined);

function preview(id: number) {
  subscriptionGeneratorStore.generate(id)
      .then(content => {
        previewContent.value = JSON.stringify(content, null, 4);
        previewVisible.value = true;
      })
      .catch(err => ElMessage.error(getErrorMessage(err.message)));

}

</script>

<template>
  <el-row justify="end">
    <el-button type="primary" @click="selectedGenerator = undefined; drawerVisible = true">添加订阅</el-button>
  </el-row>
  <el-divider/>
  <el-row>
    <el-card v-for="item in generators">
      <template #header>
        <span>{{ item.name }}</span>
      </template>
      <template #footer>
        <el-button @click="preview(item.id)" type="primary" :icon="View"/>
        <el-button @click="selectedGenerator = item; drawerVisible = true" type="primary" :icon="Edit"/>
        <el-button @click="subscriptionGeneratorStore.deleteGenerator(item.id)" type="primary" :icon="Delete"/>
      </template>
    </el-card>
  </el-row>
  <GeneratorDrawer v-model:visible="drawerVisible" :to-update-subscription-generator="selectedGenerator"/>
  <el-dialog v-model="previewVisible" width="50vh">
    <template #header>预览</template>
    <div style="height: 50vh">
      <MonacoEditor v-model="previewContent" language="json" :readonly="true" width="100%" height="100%" theme="dark"/>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.el-card {
  width: 300px;
  height: 300px;
  margin: 10px;
}
</style>