<script setup lang="ts">
import {ref} from "vue";

const visible = defineModel<boolean>("visible");
const templateType = ref<"url" | "raw">("url");

</script>

<template>
  <el-drawer title="订阅内容" v-model="visible">
    <template #header>
      <el-text>订阅内容</el-text>
    </template>
    <div class="drawer-content" style="display: flex; flex-direction: column; height: 100%">
      <el-form>
        <el-form-item>
          <el-input placeholder="请输入订阅名称"></el-input>
        </el-form-item>
        <el-form-item>
          <el-select v-model="templateType" placeholder="请选择模板类型">
            <el-option label="提供模板链接" value="url"/>
            <el-option label="自己输入模板" value="raw"/>
          </el-select>
        </el-form-item>
        <el-form-item v-show="templateType === 'url'">
          <el-input placeholder="请输入模板链接"></el-input>
        </el-form-item>
      </el-form>
      <div v-show="templateType === 'raw'" class="template-content" style="flex: 1">
        <el-input type="textarea" placeholder="请输入订阅内容" style="height: 100%" rows="20"></el-input>
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="visible = false">确 定</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
</style>