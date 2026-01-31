// LocalStorage 프로젝트 마이그레이션 스크립트
// 브라우저 콘솔에서 실행하세요

(function migrateProjects() {
  console.log('🔧 프로젝트 마이그레이션 시작...');

  const projectsJson = localStorage.getItem('story_projects');
  if (!projectsJson) {
    console.log('⚠️ 저장된 프로젝트가 없습니다.');
    return;
  }

  const projects = JSON.parse(projectsJson);
  let migrated = 0;

  projects.forEach(project => {
    project.scenes.forEach(scene => {
      // videoUrl과 videoStatus 필드가 없으면 추가
      if (!('videoUrl' in scene)) {
        scene.videoUrl = null;
        migrated++;
      }
      if (!('videoStatus' in scene)) {
        scene.videoStatus = 'idle';
        migrated++;
      }
    });
  });

  if (migrated > 0) {
    localStorage.setItem('story_projects', JSON.stringify(projects));
    console.log(`✅ ${migrated}개 필드 마이그레이션 완료!`);
    console.log('🔄 페이지를 새로고침하세요.');

    // 마이그레이션 결과 확인
    const updated = JSON.parse(localStorage.getItem('story_projects'));
    console.log('📊 업데이트된 프로젝트:', updated);
  } else {
    console.log('✅ 모든 프로젝트가 최신 상태입니다.');
  }
})();
